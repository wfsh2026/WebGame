import { equipmentRuntime } from '@web-game-world/simulation';
import { createSimulation, makePlayer, step } from '@web-game-world/simulation';
import type { Controls, Enemy, Player, Simulation, Vec } from '@web-game-world/simulation';
import type { PlayerView, Snapshot } from '@web-game-world/contracts';
import content from '../network/content';
import map from '../../../../content/packs/forest-survival/maps/arena.json';

interface Correction extends Vec { entity: Vec }
export class PresentationWorld {
  simulation: Simulation;
  playerId: string;
  lastSnapshot: Snapshot | null = null;
  lastArrival = 0;
  feedbackReset = true;
  corrections = new Map<string, Correction>();
  seenShots = new Map<string, number>();
  seenEffects = new Map<string, number>();

  constructor(playerId: string) {
    this.playerId = playerId;
    const obstacles = map.layers.flatMap(layer => layer.objects).filter(object => object.type === 'obstacle').map(object => ({ x: object.x / 32, y: object.y / 32, width: object.width / 32, height: object.height / 32 }));
    const arena = { width: map.width, height: map.height, spawns: [{ x: 15, y: 11 }], enemySpawns: [], obstacles };
    const random = () => 0;
    this.simulation = createSimulation({ config: content, arena, random });
    this.simulation.presentationOnly = true;
  }

  receive(snapshot: Snapshot, arrival: number): void {
    const previous = this.lastSnapshot;
    const reset = !previous || previous.roomId !== snapshot.roomId || (previous.stage !== 'combat' && snapshot.stage === 'combat') || arrival - this.lastArrival > 800;
    const elapsed = previous ? (snapshot.serverTime - previous.serverTime) / 1000 : 0.1;
    if (reset) { this.feedbackReset = true; this.corrections.clear(); this.seenShots.clear(); this.seenEffects.clear(); this.simulation.players = []; this.simulation.enemies = []; this.simulation.projectiles = []; this.simulation.effects = []; this.simulation.hazards = []; this.simulation.poisonWait = {}; }
    this.lastArrival = arrival;
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
    for (const effect of snapshot.effects) {
      if (this.seenEffects.has(effect.id)) continue;
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
      const weaponAhead = player.weaponCount > view.weaponCount;
      const skillAhead = player.skillCount > view.skillCount;
      const predicted = { weaponCount: player.weaponCount, skillCount: player.skillCount, weaponWait: player.weaponWait, skillWait: player.skillWait, energy: player.energy, mp: player.mp, heartWait: player.heartWait };
      const oldServer = previous?.players.find(item => item.id === view.id);
      const changedBuild = created || oldServer?.buildRevision !== view.buildRevision;
      const predictedAbilities = player.abilityStates;
      Object.assign(player, view);
      player.heartProgress = view.heartProgress ? { ...view.heartProgress } : undefined;
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
        if (weaponAhead && !changedBuild) { player.weaponCount = predicted.weaponCount; player.weaponWait = predicted.weaponWait; }
        if (skillAhead && !changedBuild) { player.skillCount = predicted.skillCount; player.skillWait = predicted.skillWait; }
        if (!changedBuild && (weaponAhead || skillAhead)) { player.energy = predicted.energy; player.mp = predicted.mp; player.heartWait = predicted.heartWait; }
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
    for (const view of snapshot.enemies) {
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
        existing.vx = view.vx; existing.vy = view.vy;
        if (view.effect === 'star') { existing.targetId = view.targetId; existing.bounces = view.bounces; existing.travel = Math.max(existing.travel ?? 0, view.travel ?? 0); }
        continue;
      }
      if (this.seenShots.has(view.id)) continue;
      this.simulation.projectiles.push({ ...view, damage: 0 });
      this.seenShots.set(view.id, this.simulation.clock + 5);
    }
  }

  update(input: Controls, delta: number): void {
    if (!this.lastSnapshot || this.lastSnapshot.stage !== 'combat') return;
    const player = this.localPlayer;
    if (player) { player.input = { ...input }; player.inputAt = this.simulation.clock; }
    const dt = Math.min(delta / 1000, 0.1);
    let remaining = dt;
    while (remaining > 0) { const duration = Math.min(remaining, 1 / 60); step(this.simulation, duration); remaining -= duration; }
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
