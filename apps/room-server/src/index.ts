import { battleState, expandBattleTransfer } from '@web-game-world/simulation';
import { attackInterval, castModifiers } from '@web-game-world/simulation';
import { waveSpawningComplete, waveDefinition } from '@web-game-world/simulation';
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
  if (!response.ok) throw new Error('业务服务暂不可用'); return response.json();
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
  buildSent = new Map<string, number>();
  compactClients = new Set<string>();
  previousSnapshots = new Map<string, Snapshot>();

  hudSent = new Map<string, number>();
  battleOwner = '';
  battleEpoch = 0;
  battleSequence = -1;
  battleArrival = 0;
  battleClients = new Map<string, number>();
  defeatedIds = new Set<string>();

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
    Object.assign(this.sim, raw.state); this.sim.defeated = defeated;
    for (const player of this.sim.players) {
      const previous = roster.find(entry => entry.id === player.id);
      player.connected = previous?.connected ?? false;
      if (this.departed.has(player.id)) player.hp = 0;
    }
    const revisions = this.sim.players.map(player => this.loot.state(player.id).revision).join(':');
    this.loot.tick();
    const after = this.sim.players.map(player => this.loot.state(player.id).revision).join(':');
    if (this.sim.finished) { this.finishRound(false); this.publishBattle(); }
    else if (!this.sim.preparing && waveSpawningComplete(this.sim) && !this.sim.enemies.some(enemy => enemy.hp > 0) && !this.sim.hazards.length && !this.sim.projectiles.some(shot => shot.hostile && shot.ttl > 0)) { this.finishRound(true); this.publishBattle(); }
    else if (revisions !== after) this.publishBattle();
    const receipt = { epoch: raw.epoch, sequence: raw.sequence }; client.send('battle-ack', receipt);
    this.sendSnapshot(); this.snapshotClock = 0;
  }
  onCreate(): void {
    this.onMessage('battle-sync', client => {
      if (!this.permit(client.sessionId, 3)) return;
      const state = battleState(this.sim);
      const packet = { ack: -1, owner: this.battleOwner, epoch: this.battleEpoch, sequence: 0, state };
      client.send('battle-owner', packet); this.sendSnapshot();
    });
    this.onMessage('battle-frame', (client, raw: unknown) => this.receiveBattle(client, raw));
    this.onMessage('battle-active', (client, raw: unknown) => { const id = this.identities.get(client.sessionId); if (!id) return; if (raw === true) this.battleClients.set(id, Date.now()); else this.battleClients.delete(id); this.selectBattleOwner(); });
    this.onMessage('compact-snapshots', (client, raw: unknown) => { if (raw === true && this.permit(client.sessionId, 3)) { this.compactClients.add(client.sessionId); this.previousSnapshots.delete(client.sessionId); } });
    const seed = randomInt(2147483647); const random = seededRandom(seed); this.sim = createSimulation({ config: content, arena, random });
    this.loot = new GroundLoot(this.sim, event => this.broadcast('loot-pickup', event));
    this.setMetadata({ name: '林地围猎', protocol: protocolVersion, stage: 'waiting' });
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
      if (!data.success || !player || this.stage !== 'combat' || !this.sim.preparing || data.data.round !== this.round || this.departed.has(player.id)) return;
      if (data.data.ready) this.waveReady.add(player.id); else this.cancelPreparation(player);
      this.publishBattle(); this.sendSnapshot();
    });
    this.onMessage('remind-ready', (client, raw: unknown) => {
      const player = this.playerFor(client);
      if (!player || raw !== this.round || !this.sim.preparing || this.reminded) return;
      this.reminded = true; this.broadcast('preparation-notice', '队友提醒：整理完成后，请点击准备完成。'); this.publishBattle(); this.sendSnapshot();
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
    this.onMessage('choose-growth', (client, raw: unknown) => {
      if (this.stage !== 'combat') return;
      const parsed = chooseGrowthSchema.safeParse(raw); const player = this.playerFor(client);
      if (!parsed.success || !player) return;
      const error = chooseGrowth(this.sim, player, parsed.data);
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
  async onAuth(client: Client, raw: unknown): Promise<unknown> { const options = joinSchema.parse(raw); const data = { token: options.token }; const result = await api('verify', data); return roomIdentitySchema.parse(result); }
  onJoin(client: Client, options: unknown, auth: unknown): void {
    const identityData = roomIdentitySchema.parse(auth);
    const profile = identityData.profile;
    if (this.stage !== 'waiting' || this.sim.players.some(player => player.id === profile.id)) throw new Error('当前无法加入此房间');
    const identity = { id: profile.id, name: profile.character?.name ?? profile.name }; const player = makePlayer(identity, content);
    if (profile.character) {
      const budget = characterBudget(profile.character, startingLoadoutAllowsShallow);
      if (!budget.valid) throw new Error('角色配置不符合当前预算规则');
      applyCharacterBuild(player, profile.character);
    }
    const savedLoadout = profile.loadout ?? defaultEquipment(content);
    const items = identityData.items;
    const loadout = migrateLoadout(savedLoadout, content, items);
    const catalog = buildCatalog(content, items);
    const ownedIds = identityData.ownedIds.map(canonicalEquipmentId);
    const context = { catalog, ownedIds };
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
    const player = this.playerFor(client); if (!player) return;
    this.previousSnapshots.delete(client.sessionId); this.hudSent.delete(client.sessionId);
    this.buildSent.delete(client.sessionId); this.lootSent.delete(client.sessionId);
    this.setPaused(false);
    this.cancelPreparation(player);
    player.connected = false; this.battleClients.delete(player.id); this.selectBattleOwner(); player.blocking = false; player.input = { sequence: player.sequence + 1, x: 0, y: 0, dash: false, block: false };
    if (!consented && this.stage !== 'final-result') {
      try { await this.allowReconnection(client, 30); const restored = this.playerFor(client); if (restored) restored.connected = true; this.publishBattle(); this.sendSnapshot(); return; } catch { /* 宽限期结束后按离场处理。 */ }
    }
    this.departed.add(player.id);
    this.compactClients.delete(client.sessionId);
    this.rates.delete(client.sessionId); this.identities.delete(client.sessionId);
    if (this.stage === 'waiting') { this.sim.players = this.sim.players.filter(item => item.id !== player.id); this.hostId = this.sim.players[0]?.id ?? ''; }
    else if (this.stage !== 'final-result') { const departed = this.playerFor(client) ?? this.sim.players.find(entry => entry.id === player.id); if (departed) departed.hp = 0; }
    this.publishBattle(); this.sendSnapshot();
  }
  async startRun(): Promise<void> {
    if (this.pending || this.sim.players.length === 0 || this.sim.players.some(player => !player.ready || !player.connected)) return;
    this.pending = true; await this.lock();
    try {
      if (!this.runId) this.runId = randomUUID();
      const players = this.sim.players.map(player => player.id); const data = { id: this.runId, roomId: this.roomId, contentVersion: content.version, ruleVersion: '1', players };
      await api('runs', data); this.stage = 'rest'; this.deadline = Date.now() + content.restDuration * 1000; this.error = '';
    } catch { this.error = '无法登记场次，请稍后重试'; await this.unlock(); }
    finally { this.pending = false; }
  }
  startRound(): void {
    this.waveReady.clear(); this.readyDeadline = 0; this.defeatedIds.clear();
    this.round += 1; this.stage = 'combat'; this.baseline.clear();
    for (const player of this.sim.players) {
      const before = { kills: player.kills, assists: player.assists, damage: player.damage, survivalSeconds: player.survivalSeconds };
      this.baseline.set(player.id, before);
    }
    beginRound(this.sim, this.round); this.publishBattle(); this.sendSnapshot();
  }
  finishRound(success: boolean): void {
    const players = this.sim.players.map(player => {
      const before = this.baseline.get(player.id);
      const pocket = this.loot.state(player.id);
      return { safe: [...pocket.safe], survivalSeconds: player.survivalSeconds - (before?.survivalSeconds ?? 0), id: player.id, kills: player.kills - (before?.kills ?? 0), assists: player.assists - (before?.assists ?? 0), damage: player.damage - (before?.damage ?? 0) };
    });
    const result = { round: this.results.length + 1, success, players };
    this.results.push(result);
    if (success) {
      awardWaveGrowth(this.sim); this.sim.preparing = true; this.preparationAt = Date.now(); this.readyDeadline = 0; this.reminded = false; this.waveReady.clear();
      this.sim.projectiles = []; this.sim.effects = []; this.sim.castHits = {};
      for (const player of this.sim.players) {
        player.dashLeft = 0;
        const before = { kills: player.kills, assists: player.assists, damage: player.damage, survivalSeconds: player.survivalSeconds };
        this.baseline.set(player.id, before);
      }
    }
    else { this.stage = 'settling'; this.sim.waveQueue = []; this.sim.waveSchedules = []; this.sim.hazards = []; this.sim.poisonWait = {}; }
  }
  async advanceSettlement(): Promise<void> {
    const now = Date.now();
    if (this.pending || now < this.retriesAt) return;
    this.pending = true;
    try {
      const result = this.results.find(item => item.round > this.savedRound);
      if (result) {
        const submission = { runId: this.runId, result };
        await api('rounds', submission); this.savedRound = result.round;
      }
      this.error = '';
      if (this.stage === 'settling' && this.savedRound === this.results.length) {
        const finish = { runId: this.runId }; const raw = await api('finish', finish);
        const settled = finalRewardsSchema.parse(raw); this.rewards = settled.rewards; this.stage = 'final-result';
      }
    } catch { this.error = '成果暂未保存，服务器正在重试'; this.retriesAt = Date.now() + 3000; }
    finally { this.pending = false; }
  }
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    const now = Date.now();
    if (paused) this.pausedAt = now;
    else {
      const duration = now - this.pausedAt;
      if (this.readyDeadline) this.readyDeadline += duration;
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
        const complete = participants.length > 0 && participants.every(player => player.connected && this.waveReady.has(player.id));
        if (!complete) this.readyDeadline = 0;
        else if (!this.readyDeadline) this.readyDeadline = now + 3000;
        else if (now >= this.readyDeadline) this.startRound();
      }
    }
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
      const kind = item.kind === 'weapon' ? 'weapon' : 'skill';
      const speed = kind === 'weapon' ? player.stats.attackSpeed : player.stats.castingSpeed;
      const interval = attackInterval(player, branch, state);
      const modifiers = state ? castModifiers(player, branch, state) : undefined; const cost = modifiers?.cost ?? item.cost * branch.costMultiplier;
      const icon = item.effect ?? 'slash';
      abilities.push({ progress: state?.progress, id: item.id, name: item.name, kind, icon, interval, remaining: state?.remaining ?? 0, cost, state: state?.state ?? '就绪', triggers: state?.count ?? 0 });
    }
    return abilities;
  }

  sendSnapshot(): void {
    const observers = this.clients.some(client => this.identities.get(client.sessionId) !== this.battleOwner);
    const players = this.sim.players.map(player => ({ banners: player.banners, heartProgress: player.heartProgress, hasteLeft: player.hasteLeft, focusLeft: player.focusLeft, shieldLeft: player.shieldLeft, lootShield: player.lootShield, manaRecovery: player.manaRecovery, resonance: player.resonance, buildItems: player.buildItems.filter(item => equippedIds(player.loadout).includes(item.id)), buildRevision: player.buildRevision, reviveRemaining: player.reviveRemaining, assists: player.assists, loadout: player.loadout, abilities: this.abilitiesFor(player), survivalSeconds: player.survivalSeconds, stats: player.stats, id: player.id, name: player.name, x: player.x, y: player.y, facingX: player.facingX, facingY: player.facingY, hp: player.hp, maxHp: player.maxHp, mp: player.mp, maxMp: player.maxMp, energy: player.energy, capacity: player.capacity, weaponWait: player.weaponWait, skillWait: player.skillWait, weaponState: player.weaponState, skillState: player.skillState, dashCooldown: player.dashCooldown, blocking: player.blocking, connected: player.connected, ready: player.ready, growth: player.growth, kills: player.kills, damage: player.damage, blocked: player.blocked, heartWait: player.heartWait, dashLeft: player.dashLeft, dashX: player.dashX, dashY: player.dashY, weaponCount: player.weaponCount, skillCount: player.skillCount, sequence: player.sequence }));
    const enemies = observers ? this.sim.enemies.map(enemy => ({ thunderResiduals: enemy.thunderResiduals, thunderMarks: enemy.thunderMarks, id: enemy.id, kind: enemy.kind, x: enemy.x, y: enemy.y, radius: enemy.radius, hp: enemy.hp, maxHp: enemy.maxHp, state: enemy.state, facingX: enemy.facingX, facingY: enemy.facingY, timer: enemy.timer, targetId: enemy.targetId, slowUntil: Math.max(0, (enemy.slowUntil ?? 0) - this.sim.clock), slowFactor: enemy.slowFactor, attackX: enemy.attackX, attackY: enemy.attackY, originX: enemy.originX, originY: enemy.originY, attackCount: enemy.attackCount, combo: enemy.combo, hitIds: enemy.hitIds, linkId: enemy.linkId, linkWait: enemy.linkWait, parentId: enemy.parentId, summonCount: enemy.summonCount, escapeLeft: enemy.escapeLeft })) : [];
    const projectiles = observers ? this.sim.projectiles.map(shot => ({ windScale: shot.windScale, overload: shot.overload, areaLevel: shot.areaLevel, areaScale: shot.areaScale, releaseLevel: shot.releaseLevel, releaseGroup: shot.releaseGroup, terminal: shot.terminal,  level: shot.level, fork: shot.fork, spread: shot.spread, echo: shot.echo, delay: shot.delay, returning: shot.returning, returnable: shot.returnable, originX: shot.originX, originY: shot.originY, travel: shot.travel, bounces: shot.bounces, secondary: shot.secondary,  sourceId: shot.sourceId, resonance: shot.resonance, empowered: shot.empowered, markDuration: shot.markDuration, effect: shot.effect, castId: shot.castId, targetId: shot.targetId, pierces: shot.pierces, hitIds: shot.hitIds, blast: shot.blast, slow: shot.slow, slowDuration: shot.slowDuration, bounce: shot.bounce, id: shot.id, x: shot.x, y: shot.y, owner: shot.owner, hostile: shot.hostile, vx: shot.vx, vy: shot.vy, ttl: shot.ttl })) : [];
    const now = this.paused ? this.pausedAt : Date.now();
    const wave = waveDefinition(this.sim); const spawningSeconds = Math.max(0, wave.interval - this.sim.elapsed);
    const seconds = this.stage === 'combat' ? this.sim.preparing ? this.readyDeadline ? Math.max(0, (this.readyDeadline - now) / 1000) : 0 : spawningSeconds : Math.max(0, (this.deadline - now) / 1000);
    const resting = this.stage === 'combat' && Boolean(this.sim.preparing);
    const participantIds = this.sim.players.filter(player => !this.departed.has(player.id)).map(player => player.id);
    const preparation = resting ? { readyIds: [...this.waveReady], participantIds, countdown: seconds, startedAt: this.preparationAt, reminded: this.reminded } : undefined;
    const spawnWarnings = waveWarnings(this.sim); const pendingSpawns = this.sim.waveQueue.length;
    const hazards = this.sim.hazards.map(item => ({ id: item.id, owner: item.owner, kind: item.kind, x: item.x, y: item.y, age: item.age, delay: item.delay, duration: item.duration, radius: item.radius, angle: item.angle, gap: item.gap, sourceX: item.sourceX, sourceY: item.sourceY }));
    const worldSnapshot: Snapshot = { paused: this.paused, preparation, loot: this.loot.ground, spawnWarnings, pendingSpawns, hazards, resting, rewards: this.rewards, protocol: protocolVersion, roomId: this.roomId, hostId: this.hostId, stage: this.stage, round: this.round, seconds, width: arena.width, height: arena.height, players, enemies, projectiles, effects: this.sim.effects, results: this.results, error: this.error, serverTime: now };
    for (const client of this.clients) {
      const owner = this.identities.get(client.sessionId) === this.battleOwner;
      const snapshot = owner ? { ...worldSnapshot, enemies: [], projectiles: [], effects: [], hazards: [] } : worldSnapshot;
      const previous = this.previousSnapshots.get(client.sessionId);
      if (owner && previous?.stage === snapshot.stage && previous.round === snapshot.round && previous.paused === snapshot.paused && now - (this.hudSent.get(client.sessionId) ?? 0) < 250) continue;
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
        const compact = { ...snapshot, players: compactPlayers, results, rewards };
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
      if (!player || this.buildSent.get(client.sessionId) === player.buildRevision) continue;
      const required = experienceNeeded(player.level);
      const build = { characterRanks: player.characterRanks, revision: player.buildRevision, level: player.level, experience: player.experience, required, upgradeCredits: player.upgradeCredits, waveCredits: player.waveCredits, items: player.buildItems, loadout: player.loadout, choices: player.choices };
      client.send('build-state', build); this.buildSent.set(client.sessionId, player.buildRevision);
    }
  }
  onDispose(): void { this.sim.enemies = []; this.sim.projectiles = []; this.sim.effects = []; this.sim.hazards = []; this.sim.poisonWait = {}; this.rates.clear(); this.identities.clear(); if (this.runId && this.stage !== 'final-result') { const data = { runId: this.runId }; void api('interrupt', data).catch(() => console.error('场次中断状态未能保存')); } }
}

const http = createServer(async (request, response) => {
  if (request.url === '/health') { response.writeHead(200); response.end('ok'); return; }
  if (request.url === '/rooms') {
    const rooms = await matchMaker.query({ name: 'expedition', locked: false, private: false });
    const visible = rooms.map(room => ({ roomId: room.roomId, clients: room.clients, maxClients: room.maxClients, name: '林地围猎' })); const text = JSON.stringify(visible);
    response.writeHead(200, { 'content-type': 'application/json' }); response.end(text); return;
  }
  response.writeHead(404); response.end();
});
const transport = new WebSocketTransport({ server: http, maxPayload: 2097152 });
const server = new Server({ transport, gracefullyShutdown: true });
server.define('expedition', ExpeditionRoom);
const recovery = { ruleVersion: '1' }; await api('recover', recovery);
const port = Number(process.env.PORT ?? 3102); await server.listen(port);

