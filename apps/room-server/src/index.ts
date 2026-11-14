import { expeditionActionSchema, expeditionDifficultySchema } from '@web-game-world/contracts';
import type { ExpeditionActionData, ExpeditionViewData } from '@web-game-world/contracts';
import { expeditionCoinMultiplier, expeditionBaseReward, expeditionCleared, clearExpeditionCombat, awardHellGrowth } from '@web-game-world/simulation';
import { refreshedGrowthOptions } from '@web-game-world/simulation';
import { refreshGrowthSchema, runStartResultSchema, runRefreshReceiptSchema } from '@web-game-world/contracts';
import type { RefreshGrowthData } from '@web-game-world/contracts';
import { battleState, expandBattleTransfer } from '@web-game-world/simulation';
import { attackInterval, castModifiers } from '@web-game-world/simulation';
import { waveDefinition } from '@web-game-world/simulation';
import { refreshCompositionPreview, waveCompositionView } from '@web-game-world/simulation';
import { waveReadySchema } from '@web-game-world/contracts';
import { GroundLoot } from './loot';
import { consumeLootSchema } from '@web-game-world/contracts';
import { discardBuildItem, initializeBuild, awardWaveGrowth, chooseGrowth, changeBuild, experienceNeeded, equippedIds, migrateLoadout, canonicalEquipmentId } from '@web-game-world/simulation';
import { chooseGrowthSchema, equipmentSaveSchema } from '@web-game-world/contracts';
import { applyEquipment, defaultEquipment, buildCatalog, equipmentError } from '@web-game-world/simulation';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID, randomInt } from 'node:crypto';
import { Server, Room, matchMaker } from '@colyseus/core';
import type { Client } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { z } from 'zod';
import { contentSchema, mapSchema, resolveContentSupports } from '@web-game-world/content-schema';
import { joinSchema, inputSchema, protocolVersion, finalRewardsSchema, roomIdentitySchema } from '@web-game-world/contracts';
import type { Snapshot, Stage, RoundResult, AbilityView, PersonalReward } from '@web-game-world/contracts';
import { createSimulation, makePlayer, beginRound, waveWarnings, revivePlayer, applyCharacterBuild, characterBudget, startingLoadoutAllowsShallow } from '@web-game-world/simulation';
import type { Simulation, Player, Arena } from '@web-game-world/simulation';

const contentUrl = new URL('../../../content/packs/forest-survival/manifest.json', import.meta.url);
const contentText = await readFile(contentUrl, 'utf8'); const rawContent: unknown = JSON.parse(contentText); const parsedContent = contentSchema.parse(rawContent);
const supportSources: Record<string, unknown> = {};
const contentFiles = [...(parsedContent.supportFiles ?? []), ...(parsedContent.equipmentFiles ?? [])];
for (const reference of contentFiles) {
  const url = new URL(reference.path, contentUrl);
  const source = await readFile(url, 'utf8');
  supportSources[reference.path] = JSON.parse(source);
}
const content = resolveContentSupports(parsedContent, supportSources);
const mapUrl = new URL('../../../content/packs/forest-survival/maps/arena.json', import.meta.url);
const mapText = await readFile(mapUrl, 'utf8'); const rawMap: unknown = JSON.parse(mapText); const map = mapSchema.parse(rawMap);
const points = map.layers.flatMap(layer => layer.objects);
const arena: Arena = { width: map.width, height: map.height, spawns: [], enemySpawns: [], obstacles: [] };
for (const point of points) { const position = { x: point.x / 32, y: point.y / 32 }; if (point.type === 'spawn') arena.spawns.push(position); else if (point.type === 'enemy-spawn') arena.enemySpawns.push(position); else arena.obstacles.push({ ...position, width: point.width / 32, height: point.height / 32 }); }
if (!arena.spawns.length || !arena.enemySpawns.length) throw new Error('地图缺少出生点');
const secret = process.env.INTERNAL_SECRET; if (!secret || secret.length < 32) throw new Error('INTERNAL_SECRET 未配置');
async function api(path: string, data: unknown): Promise<unknown> {
  const endpoint = `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3101'}/internal/${path}`;
  const body = JSON.stringify(data); const signal = AbortSignal.timeout(5000);
  const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-secret': secret ?? '' }, body, signal });
  if (!response.ok) { const raw: unknown = await response.json(); const error = z.object({ error: z.string() }).safeParse(raw); throw new Error(error.success ? error.data.error : '业务服务暂不可用'); } return response.json();
}
function seededRandom(seed: number): () => number { let value = seed; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; }; }

class ExpeditionRoom extends Room {
  maxClients = content.players.max;
  sim!: Simulation;
  loot!: GroundLoot;
  lootSent = new Map<string, number>();
  stage: Stage = 'waiting';
  hostId = '';
  round = 0;
  deadline = 0;
  runId = '';
  results: RoundResult[] = [];
  rewards: PersonalReward[] = [];
  baseline = new Map<string, { kills: number; assists: number; damage: number; survivalSeconds: number }>();
  identities = new Map<string, string>();
  rates = new Map<string, { time: number; count: number }>();
  error = '';
  paused = false;
  pausedAt = 0;
  pending = false;
  retriesAt = 0;
  accumulator = 0;
  snapshotClock = 0;
  savedRound = 0;
  waveReady = new Set<string>();
  departed = new Set<string>();
  preparationAt = 0;
  readyDeadline = 0;
  reminded = false;
  buildSent = new Map<string, string>();
  compactClients = new Set<string>();
  previousSnapshots = new Map<string, Snapshot>();

  refreshing = new Set<string>();
  refreshReceipts = new Map<string, { choiceId: number; refreshCount: number }>();
  hudSent = new Map<string, number>();
  battleOwner = '';
  battleEpoch = 0;
  battleSequence = -1;
  battleArrival = 0;
  battleClients = new Map<string, number>();
  defeatedIds = new Set<string>();
  continuedIds = new Set<string>();
  hellGifts = new Map<string, number>();
  deciding = new Set<string>();
  extractionRetries = new Set<string>();
  coinUnits = new Map<string, number>();
  terminalOutcome: 'failed' | 'hell-victory' = 'failed';

  publishBattle(): void {
    const ack = this.battleSequence; this.battleEpoch += 1; this.battleSequence = -1;
    const state = battleState(this.sim);
    const packet = { ack, owner: this.battleOwner, epoch: this.battleEpoch, sequence: 0, state };
    this.broadcast('battle-owner', packet);
  }
  selectBattleOwner(): void {
    const now = Date.now();
    const available = this.sim.players.filter(player => player.connected && now - (this.battleClients.get(player.id) ?? 0) < 2500);
    if (available.some(player => player.id === this.battleOwner) && (this.stage !== 'combat' || this.paused || now - this.battleArrival < 2500)) return;
    const next = available.find(player => player.id !== this.battleOwner) ?? available[0];
    if (next?.id === this.battleOwner || !next && !this.battleOwner) return;
    this.battleOwner = next?.id ?? ''; this.battleArrival = now; this.publishBattle(); this.sendSnapshot();
  }
  receiveBattle(client: Client, message: unknown): void {
    const id = this.identities.get(client.sessionId);
    if (id !== this.battleOwner || this.paused || this.stage !== 'combat') return;
    if (!message || typeof message !== 'object' || !('epoch' in message) || message.epoch !== this.battleEpoch || !('sequence' in message) || typeof message.sequence !== 'number' || message.sequence <= this.battleSequence) return;
    const raw = expandBattleTransfer(message, this.sim);
    if (!raw) { client.send('battle-rejected', '战斗状态传输失败，请刷新后重新连接'); return; }
    if (raw.epoch !== this.battleEpoch || raw.sequence <= this.battleSequence || raw.state.round !== this.round) return;
    const roster = this.sim.players;
    if (raw.state.players.length !== roster.length || roster.some(player => !raw.state.players.some(next => next.id === player.id))) return;
    this.battleSequence = raw.sequence; this.battleArrival = Date.now();
    const defeated = raw.state.defeated.filter(enemy => !this.defeatedIds.has(enemy.id));
    for (const enemy of defeated) this.defeatedIds.add(enemy.id);
    const { config, arena, random, presentationOnly } = this.sim;
    Object.assign(this.sim, raw.state);
    this.sim.config = config; this.sim.arena = arena; this.sim.random = random; this.sim.presentationOnly = presentationOnly; this.sim.defeated = defeated;
    for (const player of this.sim.players) {
      const previous = roster.find(entry => entry.id === player.id);
      player.connected = previous?.connected ?? false;
      player.characterLevel = previous?.characterLevel ?? 1;
      const kills = Math.max(0, player.kills - (previous?.kills ?? player.kills));
      const assists = Math.max(0, player.assists - (previous?.assists ?? player.assists));
      player.coinsEarned = previous?.coinsEarned ?? 0;
      const native = defeated.filter(enemy => {
        if (enemy.parentId) return false;
        const contribution = enemy.contributors?.[player.id];
        return enemy.killerId === player.id || contribution !== undefined && this.sim.clock - contribution <= 15;
      }).length;
      const boosted = Math.min(kills + assists, native); const ordinary = kills + assists - boosted;
      const multiplier = this.rewardMultiplier();
      this.creditCoins(player, boosted, multiplier); this.creditCoins(player, ordinary, 1);
      player.coinsSpent = previous?.coinsSpent ?? 0;
      for (let index = 0; index < player.choices.length; index += 1) {
        const choice = player.choices[index];
        const saved = previous?.choices.find(entry => entry.id === choice.id);
        if (saved && (saved.refreshCount ?? 0) > (choice.refreshCount ?? 0)) player.choices[index] = saved;
      }
      if (this.departed.has(player.id)) player.hp = 0;
    }
    const revisions = this.sim.players.map(player => this.loot.state(player.id).revision).join(':');
    this.loot.tick();
    const after = this.sim.players.map(player => this.loot.state(player.id).revision).join(':');
    const completed = this.results.some(result => result.round === this.round);
    if (!completed) {
      const wiped = this.sim.players.every(player => player.hp <= 0);
      const wave = waveDefinition(this.sim); const cleared = expeditionCleared(this.sim);
      if (wiped || this.sim.finished) { this.finishRound(false); this.publishBattle(); }
      else if (this.sim.elapsed >= wave.interval || cleared) { this.finishRound(true); this.publishBattle(); }
      else if (revisions !== after) this.publishBattle();
    } else if (revisions !== after) this.publishBattle();
    const receipt = { epoch: raw.epoch, sequence: raw.sequence }; client.send('battle-ack', receipt);
    this.sendSnapshot(); this.snapshotClock = 0;
  }
  onCreate(raw: unknown): void {
    const options = joinSchema.parse(raw);
    this.onMessage('change-difficulty', (client, message: unknown) => { void this.changeDifficulty(client, message); });
    this.onMessage('expedition-action', (client, message: unknown) => {
      const parsed = expeditionActionSchema.safeParse(message);
      if (parsed.success) void this.expeditionAction(client, parsed.data);
    });
    this.onMessage('battle-sync', client => {
      if (!this.permit(client.sessionId, 3)) return;
      const state = battleState(this.sim);
      const packet = { ack: -1, owner: this.battleOwner, epoch: this.battleEpoch, sequence: 0, state };
      client.send('battle-owner', packet); this.sendSnapshot();
    });
    this.onMessage('battle-frame', (client, raw: unknown) => this.receiveBattle(client, raw));
    this.onMessage('battle-active', (client, raw: unknown) => { const id = this.identities.get(client.sessionId); if (!id) return; if (raw === true) this.battleClients.set(id, Date.now()); else this.battleClients.delete(id); this.selectBattleOwner(); });
    this.onMessage('compact-snapshots', (client, raw: unknown) => { if (raw === true && this.permit(client.sessionId, 3)) { this.compactClients.add(client.sessionId); this.previousSnapshots.delete(client.sessionId); } });
    const seed = randomInt(2147483647); const random = seededRandom(seed); const config = { ...content, difficulty: options.difficulty }; const simulationOptions = { config, arena, random };
    this.sim = createSimulation(simulationOptions);
    this.loot = new GroundLoot(this.sim, event => this.broadcast('loot-pickup', event));
    const metadata = { name: '林地围猎', difficulty: options.difficulty, protocol: protocolVersion, stage: 'waiting' }; this.setMetadata(metadata);
    this.onMessage('pause', (client, raw: unknown) => {
      const player = this.playerFor(client);
      if (typeof raw !== 'boolean' || !player?.connected || this.stage !== 'combat' || this.sim.players.length !== 1 || !this.permit(client.sessionId, 10)) return;
      if (raw === this.paused) { this.publishBattle(); this.sendSnapshot(); return; }
      this.setPaused(raw); this.publishBattle(); this.sendSnapshot();
    });
    this.onMessage('input', (client, raw: unknown) => {
      if (this.paused || this.stage !== 'combat' || !this.permit(client.sessionId, 45)) return;
      const parsed = inputSchema.safeParse(raw); const id = this.identities.get(client.sessionId);
      if (parsed.success && id && id !== this.battleOwner) { const packet = { id, epoch: this.battleEpoch, input: parsed.data }; const owner = this.clients.find(entry => this.identities.get(entry.sessionId) === this.battleOwner); owner?.send('battle-input', packet); }
    });
    this.onMessage('wave-ready', (client, raw: unknown) => {
      const data = waveReadySchema.safeParse(raw); const player = this.playerFor(client);
      const participants = this.sim.players.filter(entry => !this.departed.has(entry.id));
      if (!data.success || !player?.connected || this.stage !== 'combat' || !this.sim.preparing || this.paused || data.data.round !== this.round || this.departed.has(player.id) || participants.length < 2) return;
      if (data.data.ready && !this.canAdvance(player)) return;
      if (data.data.ready) this.waveReady.add(player.id); else this.cancelPreparation(player);
      this.publishBattle(); this.sendSnapshot();
    });
    this.onMessage('start-wave', (client, raw: unknown) => {
      const player = this.playerFor(client);
      const participants = this.sim.players.filter(entry => !this.departed.has(entry.id));
      if (raw !== this.round || this.stage !== 'combat' || !this.sim.preparing || this.paused || this.sim.finished || !player?.connected || player.hp <= 0 || participants.length !== 1 || participants[0]?.id !== player.id) return;
      if (!this.canAdvance(player)) return;
      this.startRound();
    });
    this.onMessage('remind-ready', (client, raw: unknown) => {
      const player = this.playerFor(client);
      if (!player || raw !== this.round || !this.sim.preparing || this.reminded) return;
      this.reminded = true; this.broadcast('preparation-notice', '队友提醒：整理完成后，请点击准备。'); this.publishBattle(); this.sendSnapshot();
    });
    this.onMessage('ready', (client, raw: unknown) => { const parsed = z.boolean().safeParse(raw); const player = this.playerFor(client); if (this.stage === 'waiting' && player && parsed.success && this.permit(client.sessionId, 10)) player.ready = parsed.data; });
    this.onMessage('start', client => { const player = this.playerFor(client); if (this.stage === 'waiting' && player?.id === this.hostId && this.permit(client.sessionId, 3)) void this.startRun(); });
    this.onMessage('consume-loot', (client, raw: unknown) => {
      if (this.stage !== 'combat' || !this.permit(client.sessionId, 8)) return;
      const parsed = consumeLootSchema.safeParse(raw); const player = this.playerFor(client);
      if (!parsed.success || !player) return;
      const error = this.loot.consume(player, parsed.data.id);
      if (error) client.send('build-error', error);
      this.publishBattle(); this.sendSnapshot();
    });
    this.onMessage('revive', client => {
      if (this.stage !== 'combat' || !this.permit(client.sessionId, 3)) return;
      const player = this.playerFor(client);
      if (player) { revivePlayer(this.sim, player); this.publishBattle(); this.sendSnapshot(); }
    });
    this.onMessage('refresh-growth', (client, raw: unknown) => {
      const parsed = refreshGrowthSchema.safeParse(raw);
      if (parsed.success) void this.refreshGrowth(client, parsed.data);
    });
    this.onMessage('choose-growth', (client, raw: unknown) => {
      if (this.stage !== 'combat') return;
      const parsed = chooseGrowthSchema.safeParse(raw); const player = this.playerFor(client);
      if (!parsed.success || !player) return;
      if (this.refreshing.has(player.id)) {
        client.send('growth-receipt', { choiceId: parsed.data.choiceId });
        this.buildSent.delete(client.sessionId); this.sendSnapshot();
        client.send('build-error', '正在刷新候选项，请稍后领取'); return;
      }
      const selected = player.choices.find(choice => choice.id === parsed.data.choiceId);
      const error = chooseGrowth(this.sim, player, parsed.data);
      if (!error && selected?.hellEntry) {
        const remaining = Math.max(0, (this.hellGifts.get(player.id) ?? 0) - 1); this.hellGifts.set(player.id, remaining);
        if (remaining > 0) awardHellGrowth(this.sim, player);
      }
      const receipt = { choiceId: parsed.data.choiceId }; client.send('growth-receipt', receipt);
      if (error) client.send('build-error', error); else this.cancelPreparation(player);
      this.buildSent.delete(client.sessionId); this.publishBattle(); this.sendSnapshot();
    });
    this.onMessage('discard-build-item', (client, raw: unknown) => {
      if (this.stage !== 'combat' || !this.permit(client.sessionId, 10)) return;
      const player = this.playerFor(client);
      if (!player || typeof raw !== 'string' || raw.length > 100) return;
      const error = discardBuildItem(player, raw);
      if (error) client.send('build-error', error); else this.cancelPreparation(player);
      this.publishBattle(); this.sendSnapshot();
    });
    this.onMessage('battle-equipment', (client, raw: unknown) => {
      if (this.stage !== 'combat') return;
      const parsed = equipmentSaveSchema.safeParse(raw); const player = this.playerFor(client);
      if (!parsed.success || !player) return;
      const error = changeBuild(player, parsed.data, content);
      if (error) client.send('build-error', error); else this.cancelPreparation(player);
      this.buildSent.delete(client.sessionId); this.publishBattle(); this.sendSnapshot();
    });
    this.setSimulationInterval(delta => this.tick(delta), 50);
  }
  permit(id: string, max: number): boolean { const now = Date.now(); let record = this.rates.get(id); if (!record || now - record.time >= 1000) { record = { time: now, count: 0 }; this.rates.set(id, record); } record.count += 1; return record.count <= max; }
  playerFor(client: Client): Player | undefined { const id = this.identities.get(client.sessionId); return this.sim.players.find(player => player.id === id); }
  async onAuth(client: Client, raw: unknown): Promise<unknown> { const options = joinSchema.parse(raw); const data = { token: options.token, difficulty: this.sim.config.difficulty ?? 'normal' }; const result = await api('verify', data); return roomIdentitySchema.parse(result); }
  onJoin(client: Client, options: unknown, auth: unknown): void {
    const identityData = roomIdentitySchema.parse(auth);
    const profile = identityData.profile;
    if (this.stage !== 'waiting' || this.sim.players.some(player => player.id === profile.id)) throw new Error('当前无法加入此房间');
    const identity = { id: profile.id, name: profile.character?.name ?? profile.name }; const player = makePlayer(identity, content);
    if (profile.character) {
      const budget = characterBudget(profile.character, startingLoadoutAllowsShallow);
      if (!budget.valid) throw new Error('角色配置不符合当前预算规则');
    }
    const character = profile.character ?? { name: profile.name, description: '', points: { ...content.character.points, luck: content.character.points.luck ?? 0 }, talents: [] };
    applyCharacterBuild(player, character, profile.characterGrowth);
    const savedLoadout = profile.loadout ?? defaultEquipment(content);
    const items = identityData.items;
    const optionsData = { items, characterLevel: profile.characterLevel ?? 1 };
    const loadout = migrateLoadout(savedLoadout, content, optionsData);
    player.characterLevel = profile.characterLevel ?? 1;
    const catalog = buildCatalog(content, items);
    const ownedIds = identityData.ownedIds.map(canonicalEquipmentId);
    const context = { catalog, ownedIds, characterLevel: player.characterLevel };
    const invalid = equipmentError(loadout, context);
    if (invalid) throw new Error(invalid);
    const equipmentData = { loadout, config: content };
    applyEquipment(player, equipmentData);
    const buildData = { ids: ownedIds, items, config: content }; initializeBuild(player, buildData);
    this.sim.players.push(player); this.identities.set(client.sessionId, profile.id);
    if (!this.hostId) this.hostId = profile.id;
    this.publishBattle(); this.sendSnapshot();
  }
  async onLeave(client: Client, consented: boolean): Promise<void> {
    const player = this.playerFor(client); if (!player) { this.identities.delete(client.sessionId); this.previousSnapshots.delete(client.sessionId); return; }
    this.previousSnapshots.delete(client.sessionId); this.hudSent.delete(client.sessionId);
    this.buildSent.delete(client.sessionId); this.lootSent.delete(client.sessionId);
    this.setPaused(false);
    this.cancelPreparation(player);
    player.connected = false; this.battleClients.delete(player.id); this.selectBattleOwner(); player.blocking = false; player.input = { sequence: player.sequence + 1, x: 0, y: 0, dash: false, block: false };
    if (!consented && this.stage !== 'final-result') {
      try { await this.allowReconnection(client, 30); const restored = this.playerFor(client); if (restored) restored.connected = true; this.publishBattle(); this.sendSnapshot(); return; } catch { /* 宽限期结束后按离场处理。 */ }
    }
    this.departed.add(player.id);
    const participants = this.sim.players.filter(entry => !this.departed.has(entry.id));
    if (participants.length === 1) { this.waveReady.clear(); this.readyDeadline = 0; }
    this.compactClients.delete(client.sessionId);
    this.rates.delete(client.sessionId); this.identities.delete(client.sessionId);
    if (this.stage === 'waiting') { this.sim.players = this.sim.players.filter(item => item.id !== player.id); this.hostId = this.sim.players[0]?.id ?? ''; }
    else if (this.stage !== 'final-result') { const departed = this.playerFor(client) ?? this.sim.players.find(entry => entry.id === player.id); if (departed) departed.hp = 0; }
    this.publishBattle(); this.sendSnapshot();
  }
  async refreshGrowth(client: Client, data: RefreshGrowthData): Promise<void> {
    const player = this.playerFor(client);
    if (!player || this.stage !== 'combat' || !this.permit(client.sessionId, 5) || this.refreshing.has(player.id)) return;
    const key = `${player.id}:${data.requestId}`;
    const receipt = this.refreshReceipts.get(key);
    if (receipt) {
      if (receipt.choiceId !== data.choiceId || receipt.refreshCount !== data.refreshCount) { client.send('build-error', '刷新请求编号已用于其他操作'); return; }
      this.buildSent.delete(client.sessionId); this.sendSnapshot();
      client.send('growth-refresh-receipt', { requestId: data.requestId }); return;
    }
    const choice = player.choices.find(entry => entry.id === data.choiceId);
    if (!choice || choice.source === 'link' || (choice.refreshCount ?? 0) !== data.refreshCount) { client.send('build-error', '候选项已变化，请刷新界面后重试'); return; }
    this.refreshing.add(player.id);
    try {
      const options = refreshedGrowthOptions(this.sim, player, choice);
      if (!options.length) throw new Error('当前没有可用的成长候选项');
      const body = { ...data, runId: this.runId, accountId: player.id, earned: player.coinsEarned ?? 0, source: choice.source, options };
      const response = await api('growth-refresh', body);
      const saved = runRefreshReceiptSchema.parse(response);
      const current = this.playerFor(client) ?? this.sim.players.find(entry => entry.id === player.id);
      const active = current?.choices.find(entry => entry.id === choice.id);
      if (current) {
        current.coinsEarned = Math.max(current.coinsEarned ?? 0, saved.earned); current.coinsSpent = saved.spent;
        if (active) { active.options = saved.options; active.refreshCount = saved.refreshCount; }
        current.buildRevision += 1;
        this.cancelPreparation(current);
      }
      this.refreshReceipts.set(key, { choiceId: data.choiceId, refreshCount: data.refreshCount });
      client.send('growth-refresh-receipt', { requestId: data.requestId });
      this.publishBattle(); this.sendSnapshot();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '刷新失败，请重试';
      client.send('build-error', message);
    } finally { this.refreshing.delete(player.id); }
  }
  async changeDifficulty(client: Client, raw: unknown): Promise<void> {
    const parsed = expeditionDifficultySchema.safeParse(raw); const player = this.playerFor(client);
    if (!parsed.success || player?.id !== this.hostId || this.stage !== 'waiting' || this.pending || !this.permit(client.sessionId, 3)) return;
    const difficulty = parsed.data; const accountIds = this.sim.players.map(entry => entry.id);
    this.pending = true;
    try {
      const request = { difficulty, accountIds }; await api('difficulty-access', request);
      if (this.sim.players.length !== accountIds.length || this.sim.players.some(entry => !accountIds.includes(entry.id))) throw new Error('队伍成员已变化，请重新选择难度');
      this.sim.config = { ...this.sim.config, difficulty };
      for (const member of this.sim.players) member.ready = false;
      const metadata = { name: '林地围猎', difficulty, protocol: protocolVersion, stage: 'waiting' }; await this.setMetadata(metadata);
      this.error = ''; this.publishBattle();
    } catch (cause) { this.error = cause instanceof Error ? cause.message : '难度修改失败，请重试'; }
    finally { this.pending = false; this.sendSnapshot(); }
  }
  async startRun(): Promise<void> {
    const solo = this.sim.players.length === 1;
    const unprepared = this.sim.players.some(player => !player.connected || !solo && !player.ready);
    if (this.pending || this.sim.players.length === 0 || unprepared) return;
    this.pending = true; await this.lock();
    try {
      if (!this.runId) this.runId = randomUUID();
      const players = this.sim.players.map(player => player.id); const data = { id: this.runId, roomId: this.roomId, contentVersion: content.version, ruleVersion: '2', difficulty: this.sim.config.difficulty ?? 'normal', players };
      const response = await api('runs', data);
      const entry = runStartResultSchema.parse(response);
      for (const identity of entry.players) {
        const player = this.sim.players.find(item => item.id === identity.profile.id);
        if (!player) throw new Error('入场成员发生变化');
        player.characterLevel = identity.profile.characterLevel ?? 1;
        const character = identity.profile.character ?? { name: identity.profile.name, description: '', points: { ...content.character.points, luck: content.character.points.luck ?? 0 }, talents: [] };
        applyCharacterBuild(player, character, identity.profile.characterGrowth);
        player.loadout = identity.profile.loadout ?? { heart: null, slots: [] };
        player.coinsEarned = 0; player.coinsSpent = 0;
        const buildData = { ids: identity.ownedIds, items: identity.items, config: content };
        initializeBuild(player, buildData);
      }
      this.publishBattle(); this.stage = 'rest'; this.deadline = Date.now() + content.restDuration * 1000; this.error = '';
    } catch (cause) { this.error = cause instanceof Error ? cause.message : '无法登记场次，请稍后重试'; await this.unlock(); }
    finally { this.pending = false; }
  }
  startRound(): void {
    if (this.round >= 40) return;
    this.waveReady.clear(); this.readyDeadline = 0; this.defeatedIds.clear();
    this.round += 1; this.stage = 'combat'; this.baseline.clear();
    for (const player of this.sim.players) {
      const before = { kills: player.kills, assists: player.assists, damage: player.damage, survivalSeconds: player.survivalSeconds };
      this.baseline.set(player.id, before);
    }
    this.loot.clearGround();
    const participants = this.sim.players.filter(player => !this.departed.has(player.id)); this.sim.partySize = participants.length;
    beginRound(this.sim, this.round);
    const wave = waveDefinition(this.sim); this.deadline = Date.now() + wave.interval * 1000;
    this.publishBattle(); this.sendSnapshot();
  }
  rewardMultiplier(): number {
    return expeditionCoinMultiplier(this.sim.config, this.round);
  }
  creditCoins(player: Player, base: number, multiplier: number): void {
    const credit = Math.round(base * multiplier * 1000);
    const units = (this.coinUnits.get(player.id) ?? (player.coinsEarned ?? 0) * 1000) + credit;
    this.coinUnits.set(player.id, units); player.coinsEarned = Math.floor(units / 1000);
  }
  canAdvance(player: Player): boolean {
    if (this.savedRound < this.round || this.deciding.size || this.extractionRetries.size || this.stage !== 'combat') return false;
    if (!this.sim.players.some(player => player.hp > 0 && !this.departed.has(player.id))) return false;
    if (this.round >= 20 && !this.continuedIds.has(player.id)) return false;
    return (this.hellGifts.get(player.id) ?? 0) === 0;
  }
  async expeditionAction(client: Client, data: ExpeditionActionData): Promise<void> {
    const player = this.playerFor(client);
    if (!player || this.stage !== 'combat' || !this.sim.preparing || this.round !== data.round || this.round < 20 || this.round >= 40 || this.savedRound < this.round || this.deciding.has(player.id) || this.extractionRetries.has(player.id) || this.departed.has(player.id)) return;
    if (data.action === 'continue' && this.round === 20 && !data.acceptRisk) { client.send('build-error', '请先确认进入地狱的收益损失风险'); return; }
    if (data.action === 'continue' && this.continuedIds.has(player.id)) return;
    this.deciding.add(player.id); this.readyDeadline = 0; this.waveReady.clear(); this.sendSnapshot();
    try {
      if (data.action === 'extract') {
        await this.settlePlayers([player.id], 'extracted');
      } else {
        if (this.round === 20 && !this.hellGifts.has(player.id)) {
          const entry = { runId: this.runId, accountId: player.id, round: 20 };
          await api('hell-entry', entry);
          this.hellGifts.set(player.id, 5); awardHellGrowth(this.sim, player);
        }
        this.continuedIds.add(player.id);
      }
      this.error = ''; this.publishBattle();
    } catch (cause) {
      if (data.action === 'extract') { this.extractionRetries.add(player.id); this.retriesAt = Date.now() + 3000; this.error = '正在确认个人提取结果，请稍候'; }
      else this.error = cause instanceof Error ? cause.message : '选择尚未保存，请重试';
    }
    finally { this.deciding.delete(player.id); this.sendSnapshot(); }
  }
  async retryExtractions(): Promise<void> {
    if (this.pending || this.deciding.size) return;
    this.pending = true; const ids = [...this.extractionRetries];
    try {
      await this.settlePlayers(ids, 'extracted');
      for (const id of ids) this.extractionRetries.delete(id);
      this.error = ''; this.publishBattle();
    } catch { this.error = '正在确认个人提取结果，服务器会继续重试'; this.retriesAt = Date.now() + 3000; }
    finally { this.pending = false; this.sendSnapshot(); }
  }
  async settlePlayers(accountIds: string[], outcome: 'extracted' | 'failed' | 'hell-victory'): Promise<void> {
    const request = { runId: this.runId, accountIds, round: this.round, outcome };
    const response = await api('expedition-settle', request); const settled = finalRewardsSchema.parse(response);
    this.rewards = settled.rewards;
    if (accountIds.some(id => !settled.rewards.some(reward => reward.id === id))) throw new Error('个人收益尚未保存，请重试');
    this.sim.players = this.sim.players.filter(player => !accountIds.includes(player.id));
    for (const id of accountIds) { this.battleClients.delete(id); this.continuedIds.delete(id); this.waveReady.delete(id); }
    const participants = this.sim.players.filter(player => !this.departed.has(player.id)); this.sim.partySize = participants.length;
    if (!this.sim.players.length) this.stage = 'final-result';
    else { this.hostId = this.sim.players[0].id; this.selectBattleOwner(); }
  }
  finishRound(success: boolean): void {
    if (this.results.some(result => result.round === this.round)) return;
    if (success) {
      const base = expeditionBaseReward(this.round);
      const multiplier = this.rewardMultiplier();
      for (const player of this.sim.players) { if (!this.departed.has(player.id)) this.creditCoins(player, base, multiplier); player.buildRevision += 1; }
    }
    const players = this.sim.players.map(player => {
      const before = this.baseline.get(player.id); const safe = [...this.loot.state(player.id).safe];
      const participating = !this.departed.has(player.id);
      return { participating, coinsEarned: player.coinsEarned ?? 0, coinsSpent: player.coinsSpent ?? 0, safe, survivalSeconds: player.survivalSeconds - (before?.survivalSeconds ?? 0), id: player.id, kills: player.kills - (before?.kills ?? 0), assists: player.assists - (before?.assists ?? 0), damage: player.damage - (before?.damage ?? 0) };
    });
    const result = { round: this.round, success, players }; this.results.push(result);
    clearExpeditionCombat(this.sim); this.continuedIds.clear();
    this.preparationAt = Date.now(); this.readyDeadline = 0; this.reminded = false; this.waveReady.clear();
    if (success && this.round < 40) {
      this.sim.finished = false; refreshCompositionPreview(this.sim); awardWaveGrowth(this.sim);
    } else {
      this.sim.finished = true; this.sim.success = success;
      this.terminalOutcome = success ? 'hell-victory' : 'failed'; this.stage = 'settling';
    }
  }
  async advanceSettlement(): Promise<void> {
    const now = Date.now();
    if (this.pending || now < this.retriesAt) return;
    this.pending = true;
    try {
      const result = this.results.find(item => item.round > this.savedRound);
      if (result) { const submission = { runId: this.runId, result }; await api('rounds', submission); this.savedRound = result.round; }
      this.error = '';
      if (this.stage === 'settling' && this.savedRound === this.results.length) {
        const ids = this.sim.players.map(player => player.id); await this.settlePlayers(ids, this.terminalOutcome);
      }
    } catch { this.error = '成果暂未保存，服务器正在重试'; this.retriesAt = Date.now() + 3000; }
    finally { this.pending = false; this.sendSnapshot(); }
  }
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    const now = Date.now();
    if (paused) this.pausedAt = now;
    else {
      const duration = now - this.pausedAt;
      if (this.readyDeadline) this.readyDeadline += duration;
      if (this.deadline) this.deadline += duration;
      if (this.preparationAt) this.preparationAt += duration;
    }
    this.paused = paused; this.accumulator = 0;
    for (const player of this.sim.players) {
      player.blocking = false;
      player.input = { sequence: player.sequence, x: 0, y: 0, dash: false, block: false };
    }
  }
  tick(delta: number): void {
    const now = Date.now();
    if (this.stage === 'rest' && now >= this.deadline) this.startRound();
    if (this.stage === 'combat' && !this.paused) {
      this.selectBattleOwner();
      if (this.sim.preparing) {
        const participants = this.sim.players.filter(player => !this.departed.has(player.id));
        const complete = participants.length > 1 && participants.every(player => player.connected && this.waveReady.has(player.id) && this.canAdvance(player));
        if (!complete) this.readyDeadline = 0;
        else if (!this.readyDeadline) this.readyDeadline = now + 3000;
        else if (now >= this.readyDeadline) this.startRound();
      }
    }
    if (this.extractionRetries.size && now >= this.retriesAt) void this.retryExtractions();
    if (this.savedRound < this.results.length || this.stage === 'settling') void this.advanceSettlement();
    this.snapshotClock += delta; const interval = 500;
    if (this.snapshotClock >= interval) { this.snapshotClock = 0; this.sendSnapshot(); }
  }
  cancelPreparation(player: Player): void {
    if (!this.sim.preparing) return;
    const wasReady = this.waveReady.delete(player.id); this.readyDeadline = 0;
    if (wasReady) {
      const client = this.clients.find(entry => this.identities.get(entry.sessionId) === player.id);
      client?.send('preparation-notice', '准备已取消，请整理完成后重新准备。');
    }
  }
  abilitiesFor(player: Player): AbilityView[] {
    const abilities: AbilityView[] = [];
    for (const branch of player.equipment.branches) {
      const item = branch.item;
      const state = player.abilityStates.find(entry => entry.itemId === item.id);
      const kind = 'skill';
      const skillType = item.skillType ?? 'ranged';
      const speed = skillType === 'melee' ? player.stats.attackSpeed : player.stats.castingSpeed;
      const interval = attackInterval(player, branch, state);
      const modifiers = state ? castModifiers(player, branch, state) : undefined; const cost = modifiers?.cost ?? item.cost * branch.costMultiplier;
      const icon = item.effect ?? 'slash';
      abilities.push({ progress: state?.progress, id: item.id, name: item.name, kind, skillType, icon, interval, remaining: state?.remaining ?? 0, cost, state: state?.state ?? '就绪', triggers: state?.count ?? 0 });
    }
    return abilities;
  }

  sendSnapshot(): void {
    const observers = this.clients.some(client => this.identities.get(client.sessionId) !== this.battleOwner);
    const players = this.sim.players.map(player => ({ guard: player.guard, level: player.level, experience: player.experience, characterLevel: player.characterLevel, banners: player.banners, heartProgress: player.heartProgress, hasteLeft: player.hasteLeft, focusLeft: player.focusLeft, shieldLeft: player.shieldLeft, lootShield: player.lootShield, energyRecoveryBonus: player.energyRecoveryBonus, resonance: player.resonance, buildItems: player.buildItems.filter(item => equippedIds(player.loadout).includes(item.id)), buildRevision: player.buildRevision, reviveRemaining: player.reviveRemaining, assists: player.assists, loadout: player.loadout, abilities: this.abilitiesFor(player), survivalSeconds: player.survivalSeconds, stats: player.stats, id: player.id, name: player.name, x: player.x, y: player.y, facingX: player.facingX, facingY: player.facingY, hp: player.hp, maxHp: player.maxHp, energy: player.energy, capacity: player.capacity, meleeWait: player.meleeWait, rangedWait: player.rangedWait, meleeState: player.meleeState, rangedState: player.rangedState, dashCooldown: player.dashCooldown, blocking: player.blocking, connected: player.connected, ready: player.ready, growth: player.growth, kills: player.kills, damage: player.damage, blocked: player.blocked, heartWait: player.heartWait, dashLeft: player.dashLeft, dashX: player.dashX, dashY: player.dashY, meleeCount: player.meleeCount, rangedCount: player.rangedCount, sequence: player.sequence }));
    const enemies = observers ? this.sim.enemies.map(enemy => ({ abilities: enemy.abilities, bornWave: enemy.bornWave, expiresAt: enemy.expiresAt, healthScale: enemy.healthScale, damageScale: enemy.damageScale, thunderResiduals: enemy.thunderResiduals, thunderMarks: enemy.thunderMarks, id: enemy.id, kind: enemy.kind, x: enemy.x, y: enemy.y, radius: enemy.radius, hp: enemy.hp, maxHp: enemy.maxHp, state: enemy.state, facingX: enemy.facingX, facingY: enemy.facingY, timer: enemy.timer, targetId: enemy.targetId, slowUntil: Math.max(0, (enemy.slowUntil ?? 0) - this.sim.clock), slowFactor: enemy.slowFactor, attackX: enemy.attackX, attackY: enemy.attackY, originX: enemy.originX, originY: enemy.originY, attackCount: enemy.attackCount, combo: enemy.combo, hitIds: enemy.hitIds, linkId: enemy.linkId, linkWait: enemy.linkWait, parentId: enemy.parentId, summonCount: enemy.summonCount, escapeLeft: enemy.escapeLeft })) : [];
    const projectiles = observers ? this.sim.projectiles.map(shot => ({ homing: shot.homing, homingTravel: shot.homingTravel, windScale: shot.windScale, overload: shot.overload, areaLevel: shot.areaLevel, areaScale: shot.areaScale, releaseLevel: shot.releaseLevel, releaseGroup: shot.releaseGroup, releaseAngle: shot.releaseAngle, terminal: shot.terminal,  level: shot.level, fork: shot.fork, spread: shot.spread, echo: shot.echo, delay: shot.delay, returning: shot.returning, returnable: shot.returnable, originX: shot.originX, originY: shot.originY, travel: shot.travel, bounces: shot.bounces, secondary: shot.secondary,  sourceId: shot.sourceId, resonance: shot.resonance, empowered: shot.empowered, markDuration: shot.markDuration, effect: shot.effect, castId: shot.castId, targetId: shot.targetId, pierces: shot.pierces, hitIds: shot.hitIds, blast: shot.blast, slow: shot.slow, slowDuration: shot.slowDuration, bounce: shot.bounce, id: shot.id, x: shot.x, y: shot.y, owner: shot.owner, hostile: shot.hostile, vx: shot.vx, vy: shot.vy, ttl: shot.ttl })) : [];
    const now = this.paused ? this.pausedAt : Date.now();
    const currentWave = waveDefinition(this.sim); const combatSeconds = Math.max(0, currentWave.interval - this.sim.elapsed);
    const seconds = this.stage === 'combat' ? this.sim.preparing ? this.readyDeadline ? Math.max(0, (this.readyDeadline - now) / 1000) : 0 : combatSeconds : Math.max(0, (this.deadline - now) / 1000);
    const resting = this.stage === 'combat' && Boolean(this.sim.preparing);
    const participantIds = this.sim.players.filter(player => !this.departed.has(player.id)).map(player => player.id);
    const preparation = resting ? { readyIds: [...this.waveReady], participantIds, countdown: seconds, startedAt: this.preparationAt, reminded: this.reminded } : undefined;
    const spawnWarnings = waveWarnings(this.sim); const pendingSpawns = this.sim.waveQueue.length;
    const currentPlan = waveCompositionView(this.sim.waveDirector?.current);
    const nextPlan = waveCompositionView(this.sim.waveDirector?.next);
    const wavePlans = currentPlan || nextPlan ? { current: currentPlan, next: nextPlan } : undefined;
    const hazards = this.sim.hazards.map(item => ({ innerRadius: item.innerRadius, length: item.length, width: item.width, persistent: item.persistent, id: item.id, owner: item.owner, kind: item.kind, x: item.x, y: item.y, age: item.age, delay: item.delay, duration: item.duration, radius: item.radius, angle: item.angle, gap: item.gap, sourceX: item.sourceX, sourceY: item.sourceY }));
    const gifts = Object.fromEntries(this.hellGifts);
    const expedition: ExpeditionViewData = { difficulty: this.sim.config.difficulty ?? 'normal', stages: 20, hellStages: 20, hellFloor: Math.max(0, this.round - 20), baseCleared: this.round >= 20 && this.results.some(result => result.round === 20 && result.success), decision: resting && this.round >= 20 && this.round < 40, saving: this.savedRound < this.round || this.deciding.size > 0 || this.extractionRetries.size > 0, continuedIds: [...this.continuedIds], gifts };
    const worldSnapshot: Snapshot = { expedition, experienceOrbs: this.sim.experienceOrbs, battleClock: this.sim.clock, wavePlans, paused: this.paused, preparation, loot: this.loot.ground, spawnWarnings, pendingSpawns, hazards, resting, rewards: this.rewards, protocol: protocolVersion, roomId: this.roomId, hostId: this.hostId, stage: this.stage, round: this.round, seconds, width: arena.width, height: arena.height, players, enemies, projectiles, effects: this.sim.effects, results: this.results, error: this.error, serverTime: now };
    for (const client of this.clients) {
      const owner = this.identities.get(client.sessionId) === this.battleOwner;
      const snapshot = owner ? { ...worldSnapshot, enemies: [], projectiles: [], effects: [], hazards: [], experienceOrbs: [] } : worldSnapshot;
      const previous = this.previousSnapshots.get(client.sessionId);
      const preparationChanged = Boolean(previous?.preparation) !== Boolean(snapshot.preparation) || Boolean(previous?.resting) !== Boolean(snapshot.resting);
      if (owner && previous?.stage === snapshot.stage && previous.round === snapshot.round && previous.paused === snapshot.paused && !preparationChanged && now - (this.hudSent.get(client.sessionId) ?? 0) < 250) continue;
      this.hudSent.set(client.sessionId, now);
      if (!this.compactClients.has(client.sessionId) || !previous || previous.stage !== snapshot.stage) client.send('snapshot', snapshot);
      else {
        const entries = previous.players.map(player => [player.id, player] as const);
        const oldPlayers = new Map(entries);
        const compactPlayers = players.map(player => {
          const old = oldPlayers.get(player.id);
          if (!old || old.buildRevision !== player.buildRevision) return player;
          const { buildItems, loadout, ...moving } = player;
          return moving;
        });
        const results = previous.results.length === snapshot.results.length ? undefined : snapshot.results;
        const rewards = previous.rewards === snapshot.rewards ? undefined : snapshot.rewards;
        const plansUnchanged = previous.round === snapshot.round && previous.wavePlans?.current?.id === snapshot.wavePlans?.current?.id && previous.wavePlans?.next?.id === snapshot.wavePlans?.next?.id;
        const wavePlans = plansUnchanged ? undefined : snapshot.wavePlans;
        const compact = { ...snapshot, wavePlans, players: compactPlayers, results, rewards };
        client.send('snapshot-compact', compact);
      }
      if (this.compactClients.has(client.sessionId)) this.previousSnapshots.set(client.sessionId, { ...snapshot, results: [...snapshot.results] });
    }
    for (const client of this.clients) {
      const player = this.playerFor(client);
      if (player) {
        if (player.growthNotices?.length) { const notice = player.growthNotices.join('；'); client.send('preparation-notice', notice); player.growthNotices = []; }
        if (player.fusionNotices?.length) { const notice = `自动合成：${player.fusionNotices.join('；')}`; client.send('build-fusion', notice); player.fusionNotices = []; }
        const pocket = this.loot.state(player.id);
        if (this.lootSent.get(client.sessionId) !== pocket.revision) { client.send('loot-state', pocket); this.lootSent.set(client.sessionId, pocket.revision); }
      }
      if (!player) continue;
      const buildKey = `${player.buildRevision}:${player.coinsEarned ?? 0}:${player.coinsSpent ?? 0}`;
      if (this.buildSent.get(client.sessionId) === buildKey) continue;
      const required = experienceNeeded(player.level);
      const build = { characterLevel: player.characterLevel ?? 1, coinsEarned: player.coinsEarned ?? 0, coinsSpent: player.coinsSpent ?? 0, characterRanks: player.characterRanks, revision: player.buildRevision, level: player.level, experience: player.experience, required, upgradeCredits: player.upgradeCredits, waveCredits: player.waveCredits, items: player.buildItems, loadout: player.loadout, choices: player.choices };
      client.send('build-state', build); this.buildSent.set(client.sessionId, buildKey);
    }
  }
  onDispose(): void { this.sim.enemies = []; this.sim.projectiles = []; this.sim.effects = []; this.sim.hazards = []; this.sim.poisonWait = {}; this.rates.clear(); this.identities.clear(); if (this.runId && this.stage !== 'final-result') { const data = { runId: this.runId }; void api('interrupt', data).catch(() => console.error('场次中断状态未能保存')); } }
}

const http = createServer(async (request, response) => {
  if (request.url === '/health') { response.writeHead(200); response.end('ok'); return; }
  if (request.url === '/rooms') {
    const rooms = await matchMaker.query({ name: 'expedition', locked: false, private: false });
    const visible = rooms.map(room => ({ roomId: room.roomId, clients: room.clients, maxClients: room.maxClients, name: '林地围猎', difficulty: room.metadata?.difficulty ?? 'normal' })); const text = JSON.stringify(visible);
    response.writeHead(200, { 'content-type': 'application/json' }); response.end(text); return;
  }
  response.writeHead(404); response.end();
});
const transport = new WebSocketTransport({ server: http, maxPayload: 2097152 });
const server = new Server({ transport, gracefullyShutdown: true });
server.define('expedition', ExpeditionRoom);
const recovery = { ruleVersion: '1' }; await api('recover', recovery);
const port = Number(process.env.PORT ?? 3102); await server.listen(port);

