import type { ClientBattle } from '../network/client-battle';
import { equipmentRuntime } from '@web-game-world/simulation';
import { createSimulation, makePlayer, step } from '@web-game-world/simulation';
import type { Controls, Enemy, Player, Simulation, Vec } from '@web-game-world/simulation';
import type { PlayerView, Snapshot } from '@web-game-world/contracts';
import content from '../network/content';
import map from '../../../../content/packs/forest-survival/maps/arena.json';

interface Correction extends Vec { entity: Vec }
export class PresentationWorld {
  simulation: Simulation;
  channel?: ClientBattle;
  authoritative = false;
  ownershipEpoch = -1;
  private ownershipBaseline?: Player[];
  private connection?: ClientBattle;
  playerId: string;
  lastSnapshot: Snapshot | null = null;
  lastArrival = 0;
  feedbackReset = true;
  corrections = new Map<string, Correction>();
  velocities = new Map<string, Vec>();
  seenShots = new Map<string, number>();
  seenEffects = new Map<string, number>();

  constructor(playerId: string) {
    this.playerId = playerId;
    const obstacles = map.layers.flatMap(layer => layer.objects).filter(object => object.type === 'obstacle').map(object => ({ x: object.x / 32, y: object.y / 32, width: object.width / 32, height: object.height / 32 }));
    const objects = map.layers.flatMap(layer => layer.objects);
    const spawns = objects.filter(point => point.type === 'spawn').map(point => ({ x: point.x / 32, y: point.y / 32 }));
    const enemySpawns = objects.filter(point => point.type === 'enemy-spawn').map(point => ({ x: point.x / 32, y: point.y / 32 }));
    const arena = { width: map.width, height: map.height, spawns, enemySpawns, obstacles };
    const random = Math.random;
    this.simulation = createSimulation({ config: content, arena, random });
    this.simulation.presentationOnly = true;
  }

  receiveOwnership(): void {
    const channel = this.channel;
    if (channel !== this.connection) {
      this.connection = channel; this.authoritative = false; this.ownershipBaseline = undefined;
      const options = { config: this.simulation.config, arena: this.simulation.arena, random: this.simulation.random };
      this.simulation = createSimulation(options); this.simulation.presentationOnly = true;
      this.lastSnapshot = null; this.corrections.clear(); this.velocities.clear(); this.seenShots.clear(); this.seenEffects.clear();
      this.feedbackReset = true;
    }
    const transfer = channel?.pending;
    if (!channel || !transfer) return;
    channel.pending = undefined;
    const mine = transfer.owner === this.playerId;
    const sameRoster = this.simulation.players.length === transfer.state.players.length && transfer.state.players.every(player => this.simulation.players.some(current => current.id === player.id));
    const continuous = sameRoster && mine && this.authoritative && this.simulation.round === transfer.state.round && Boolean(this.simulation.preparing) === Boolean(transfer.state.preparing) && !transfer.state.finished;
    const baseline = channel.submitted.get(transfer.ack) ?? (transfer.ack < 0 ? this.ownershipBaseline : undefined);
    if (continuous && baseline) {
      for (const update of transfer.state.players) {
        const current = this.simulation.players.find(player => player.id === update.id);
        const before = baseline.find(player => player.id === update.id);
        if (!current || !before) continue;
        this.mergePlayer(current, { before, update });
      }
    } else if (mine) {
      const local = this.localPlayer;
      const position = local && this.authoritative && this.simulation.round === transfer.state.round ? { x: local.x, y: local.y, facingX: local.facingX, facingY: local.facingY } : undefined;
      Object.assign(this.simulation, transfer.state);
      const player = this.localPlayer;
      if (player && position) Object.assign(player, position);
      this.corrections.clear(); this.feedbackReset = !continuous;
    }
    this.authoritative = mine; this.ownershipEpoch = transfer.epoch;
    if (mine) for (const player of this.simulation.players) player.clientDriven = player.id !== this.playerId;
    const ownershipBaseline = structuredClone(transfer.state.players);
    this.ownershipBaseline = ownershipBaseline;
    this.simulation.presentationOnly = !mine;
    channel.submitted.clear();
  }
  private mergePlayer(current: Player, change: { before: Player; update: Player }): void {
    const { before, update } = change;
    const hp = Math.min(update.maxHp, current.hp + update.hp - before.hp);
    const energy = Math.min(update.capacity, current.energy + update.energy - before.energy);
    current.hp = Math.max(0, hp); current.energy = Math.max(0, energy);
    const fields = ['guard', 'characterLevel', 'coinsEarned', 'coinsSpent', 'connected', 'ready', 'maxHp', 'capacity', 'stats', 'baseStats', 'characterRanks', 'energyRecoveryBonus', 'loadout', 'equipment', 'buildItems', 'buildRevision', 'level', 'experience', 'upgradeCredits', 'waveCredits', 'choiceSequence', 'choices', 'abilityStates', 'reviveRemaining', 'hasteLeft', 'focusLeft', 'shieldLeft', 'lootShield', 'growth', 'companionGranted', 'companionMilestones'] as const;
    for (const key of fields) this.mergeField(current, change, key);
  }
  private mergeField<K extends keyof Player>(current: Player, change: { before: Player; update: Player }, key: K): void {
    const old = JSON.stringify(change.before[key]); const next = JSON.stringify(change.update[key]);
    if (old !== next) current[key] = change.update[key];
  }

  receive(snapshot: Snapshot, arrival: number): void {
    const difficulty = snapshot.expedition?.difficulty ?? 'normal';
    if (this.simulation.config.difficulty !== difficulty) this.simulation.config = { ...content, difficulty };
    if (this.authoritative) { this.lastSnapshot = snapshot; this.lastArrival = arrival; return; }
    const previous = this.lastSnapshot;
    const reset = !previous || previous.roomId !== snapshot.roomId || (previous.stage !== 'combat' && snapshot.stage === 'combat');
    const elapsed = previous ? (snapshot.serverTime - previous.serverTime) / 1000 : 0.1;
    if (reset) { this.feedbackReset = true; this.corrections.clear(); this.seenShots.clear(); this.seenEffects.clear(); this.simulation.players = []; this.simulation.enemies = []; this.simulation.projectiles = []; this.simulation.effects = []; this.simulation.hazards = []; this.simulation.poisonWait = {}; }
    this.lastArrival = arrival;
    this.simulation.experienceOrbs = (snapshot.experienceOrbs ?? []).map(orb => ({ ...orb }));
    if (snapshot.battleClock !== undefined) this.simulation.clock = snapshot.battleClock;
    this.simulation.round = snapshot.round; this.simulation.preparing = Boolean(snapshot.preparation);
    this.receivePlayers(snapshot.players, { reset, elapsed });
    this.receiveEnemies(snapshot, reset);
    this.receiveProjectiles(snapshot);
    if (snapshot.preparation) { this.simulation.projectiles = []; this.simulation.effects = []; }
    const hazards = snapshot.hazards ?? [];
    this.simulation.hazards = hazards.map(view => {
      const previous = this.simulation.hazards.find(item => item.id === view.id);
      const age = previous ? Math.max(view.age, previous.age) : view.age;
      return { ...view, age, damage: 0, hitIds: [] };
    });
    const flagIds = snapshot.effects.filter(effect => effect.banner).map(effect => effect.id);
    const authoritativeFlags = new Set(flagIds);
    this.simulation.effects = this.simulation.effects.filter(effect => {
      if (!effect.banner || authoritativeFlags.has(effect.id)) return true;
      const owner = this.simulation.players.find(player => player.id === effect.owner);
      const predicted = owner?.abilityStates.find(state => state.itemId === effect.sourceId);
      const confirmed = snapshot.players.find(player => player.id === effect.owner)?.abilities?.find(state => state.id === effect.sourceId);
      return Boolean(predicted && confirmed && predicted.count > confirmed.triggers);
    });
    for (const effect of snapshot.effects) {
      if (effect.banner) {
        const existing = this.simulation.effects.find(entry => entry.id === effect.id);
        const banner = { ...effect.banner, levels: { ...effect.banner.levels } };
        if (existing) Object.assign(existing, effect, { banner }); else this.simulation.effects.push({ ...effect, banner });
        this.seenEffects.set(effect.id, this.simulation.clock + effect.ttl + 1); continue;
      }
      if (this.seenEffects.has(effect.id)) {
        if (effect.kind === 'ability-novel-beam') {
          const existing = this.simulation.effects.find(entry => entry.id === effect.id);
          if (existing) { existing.facingX = effect.facingX; existing.facingY = effect.facingY; existing.targetId = effect.targetId; }
        }
        continue;
      }
      this.simulation.effects.push({ ...effect }); this.seenEffects.set(effect.id, this.simulation.clock + 5);
    }
    this.lastSnapshot = snapshot;
  }

  receivePlayers(views: PlayerView[], timing: { reset: boolean; elapsed: number }): void {
    const previous = this.lastSnapshot;
    const players: Player[] = [];
    for (const view of views) {
      let player = this.simulation.players.find(item => item.id === view.id);
      const created = !player;
      if (!player) { const identity = { id: view.id, name: view.name }; player = makePlayer(identity, content); }
      const mine = view.id === this.playerId;
      const oldPosition = { x: player.x, y: player.y, facingX: player.facingX, facingY: player.facingY, dashLeft: player.dashLeft, dashX: player.dashX, dashY: player.dashY, dashCooldown: player.dashCooldown, blocking: player.blocking };
      const meleeAhead = player.meleeCount > view.meleeCount;
      const rangedAhead = player.rangedCount > view.rangedCount;
      const predicted = { meleeCount: player.meleeCount, rangedCount: player.rangedCount, meleeWait: player.meleeWait, rangedWait: player.rangedWait, energy: player.energy, heartWait: player.heartWait };
      const oldServer = previous?.players.find(item => item.id === view.id);
      player.characterLevel = view.characterLevel ?? 1;
      const changedBuild = created || oldServer?.buildRevision !== view.buildRevision;
      const predictedAbilities = player.abilityStates;
      Object.assign(player, view);
      player.banners = view.banners ? { selfBudget: view.banners.selfBudget, buffs: view.banners.buffs.map(buff => ({ ...buff })) } : undefined;
      player.heartProgress = view.heartProgress ? { ...view.heartProgress } : undefined;
      player.guard = view.guard ? { ...view.guard } : undefined;
      player.resonance = view.resonance ? { ...view.resonance } : undefined;
      if (changedBuild) player.equipment = equipmentRuntime(player.loadout, content, player.buildItems);
      player.abilityStates = (view.abilities ?? []).map(ability => {
        const predicted = predictedAbilities.find(item => item.itemId === ability.id);
        if (!created && !timing.reset && !changedBuild && view.hp > 0 && predicted && predicted.count > ability.triggers) return predicted;
        return { progress: ability.progress ? { ...ability.progress } : undefined, itemId: ability.id, remaining: ability.remaining, count: ability.triggers, state: ability.state };
      });
      player.clientDriven = false;
      if (!created && !timing.reset && (oldServer?.hp === undefined || (oldServer.hp > 0) === (view.hp > 0))) {
        if (mine) Object.assign(player, oldPosition);
        else {
          player.x = oldPosition.x; player.y = oldPosition.y;
          const correction = { entity: player, x: view.x - player.x, y: view.y - player.y }; this.corrections.set(view.id, correction);
        }
        if (meleeAhead && !changedBuild) { player.meleeCount = predicted.meleeCount; player.meleeWait = predicted.meleeWait; }
        if (rangedAhead && !changedBuild) { player.rangedCount = predicted.rangedCount; player.rangedWait = predicted.rangedWait; }
        if (!changedBuild && (meleeAhead || rangedAhead)) { player.energy = predicted.energy; player.heartWait = predicted.heartWait; }
      }
      if (!mine) {
        const dx = oldServer ? view.x - oldServer.x : 0; const dy = oldServer ? view.y - oldServer.y : 0;
        const duration = Math.max(0.01, timing.elapsed); const speed = player.stats.movementSpeed;
        const x = dx / duration / speed; const y = dy / duration / speed;
        player.input = { sequence: 0, x, y, block: view.blocking, dash: false }; player.inputAt = this.simulation.clock;
      }
      players.push(player);
    }
    this.simulation.players = players;
  }

  receiveEnemies(snapshot: Snapshot, reset: boolean): void {
    const enemies: Enemy[] = [];
    const entries = this.simulation.enemies.map(enemy => [enemy.id, enemy] as const);
    const existing = new Map(entries);
    const definitions = content.enemies.map(enemy => [enemy.kind, enemy] as const);
    const catalog = new Map(definitions);
    const oldEntries = this.lastSnapshot?.enemies.map(enemy => [enemy.id, enemy] as const) ?? [];
    const oldEnemies = new Map(oldEntries);
    const elapsed = this.lastSnapshot ? Math.max(.01, (snapshot.serverTime - this.lastSnapshot.serverTime) / 1000) : .1;
    this.velocities.clear();
    for (const view of snapshot.enemies) {
      const before = oldEnemies.get(view.id);
      if (before && before.state === view.state) this.velocities.set(view.id, { x: (view.x - before.x) / elapsed, y: (view.y - before.y) / elapsed });
      const base = catalog.get(view.kind); if (!base) continue;
      const definition = { ...base, hp: view.maxHp, damage: base.damage * (view.damageScale ?? 1), radius: view.radius };
      let enemy = existing.get(view.id);
      if (!enemy || reset) enemy = { ...view, definition };
      else {
        const position = { x: enemy.x, y: enemy.y };
        const phases: Record<string, number> = { windup: 1, channel: 1, detonating: 1, charge: 2, recovery: 3, spent: 4 };
        const sameAttack = enemy.attackCount === view.attackCount;
        const ahead = sameAttack && (phases[enemy.state] ?? 0) > (phases[view.state] ?? 0) && (phases[view.state] ?? 0) > 0;
        const predicted = { state: enemy.state, timer: enemy.timer, hitIds: enemy.hitIds };
        Object.assign(enemy, view);
        if (ahead) { Object.assign(enemy, predicted); enemy.x = position.x; enemy.y = position.y; }
        else if (sameAttack && predicted.state === view.state) enemy.timer = Math.min(predicted.timer, view.timer);
        if (enemy.state === 'chase' || enemy.state === 'seek' || enemy.state === 'flee' || enemy.state === 'retreat') {
          enemy.x = position.x; enemy.y = position.y;
          const correction = { entity: enemy, x: view.x - enemy.x, y: view.y - enemy.y }; this.corrections.set(view.id, correction);
        } else this.corrections.delete(view.id);
      }
      enemy.slowUntil = this.simulation.clock + (view.slowUntil ?? 0);
      enemies.push(enemy);
    }
    this.simulation.enemies = enemies;
    const ids = enemies.map(enemy => enemy.id); const retained = new Set(ids);
    for (const id of this.corrections.keys()) if (id.startsWith('enemy-') && !retained.has(id)) this.corrections.delete(id);
  }

  receiveProjectiles(snapshot: Snapshot): void {
    const entries = this.simulation.projectiles.map(shot => [shot.id, shot] as const);
    const shots = new Map(entries);
    for (const view of snapshot.projectiles) {
      const existing = shots.get(view.id);
      if (existing) {
        existing.vx = view.vx; existing.vy = view.vy; existing.windScale = view.windScale;
        if (view.effect === 'star') { existing.targetId = view.targetId; existing.bounces = view.bounces; existing.travel = Math.max(existing.travel ?? 0, view.travel ?? 0); }
        if (view.homing) {
          existing.homing = view.homing; existing.targetId = view.targetId; existing.hitIds = view.hitIds;
          existing.returning = view.returning; existing.returnable = view.returnable;
          const travelled = Math.max(existing.homingTravel ?? 0, view.homingTravel ?? 0);
          existing.homingTravel = travelled;
        }
        continue;
      }
      if (this.seenShots.has(view.id)) continue;
      this.simulation.projectiles.push({ ...view, damage: 0 });
      this.seenShots.set(view.id, this.simulation.clock + 5);
    }
  }

  update(input: Controls, delta: number): void {
    if (!this.lastSnapshot || this.lastSnapshot.stage !== 'combat' || this.lastSnapshot.paused) return;
    const channel = this.channel;
    if (channel) for (const message of channel.inputs.splice(0)) {
      if (!this.authoritative || message.id === this.playerId) continue;
      const remote = this.simulation.players.find(player => player.id === message.id);
      if (!remote || message.input.sequence <= remote.sequence) continue;
      remote.input = message.input; remote.sequence = message.input.sequence; remote.inputAt = this.simulation.clock;
      const position = message.input.position;
      if (position) { remote.x = position.x; remote.y = position.y; remote.facingX = position.facingX; remote.facingY = position.facingY; remote.clientDriven = true; }
    }
    const player = this.localPlayer;
    if (player) { player.input = { ...input }; player.inputAt = this.simulation.clock; player.clientDriven = false; }
    const dt = Math.min(delta / 1000, 1 / 30);
    let remaining = dt;
    const localId = this.authoritative ? undefined : this.playerId;
    while (remaining > .000001) { const duration = Math.min(remaining, 1 / 60); step(this.simulation, duration, localId); remaining -= duration; }
    if (!this.authoritative && performance.now() - this.lastArrival < 200) for (const enemy of this.simulation.enemies) {
      const velocity = this.velocities.get(enemy.id);
      if (velocity) { enemy.x += velocity.x * dt; enemy.y += velocity.y * dt; }
    }
    if (this.authoritative) return;
    for (const shot of this.simulation.projectiles) this.seenShots.set(shot.id, this.simulation.clock + 5);
    for (const effect of this.simulation.effects) this.seenEffects.set(effect.id, this.simulation.clock + 5);
    const correctionFraction = 1 - Math.exp(-dt / 0.1);
    for (const [id, correction] of this.corrections) {
      const x = correction.x * correctionFraction; const y = correction.y * correctionFraction;
      correction.entity.x += x; correction.entity.y += y; correction.x -= x; correction.y -= y;
      const residual = Math.abs(correction.x) + Math.abs(correction.y); if (residual < 0.001) this.corrections.delete(id);
    }
    for (const [id, expiry] of this.seenShots) if (expiry < this.simulation.clock) this.seenShots.delete(id);
    for (const [id, expiry] of this.seenEffects) if (expiry < this.simulation.clock) this.seenEffects.delete(id);
  }

  get localPlayer(): Player | undefined { return this.simulation.players.find(player => player.id === this.playerId); }
}
