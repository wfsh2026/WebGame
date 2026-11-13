import { waveEnemyLimit } from './waves';
import type { Arena, Effect, Enemy, Player, Simulation, Vec } from './index';

export interface EnemyHazard extends Vec {
  id: string; owner: string; kind: 'poison' | 'egg' | 'echo'; age: number; delay: number; duration: number;
  radius: number; damage: number; angle: number; gap: number; sourceX: number; sourceY: number; hitIds: string[];
}
export interface EnemyActions {
  move: (sim: Simulation, entity: Vec, movement: { x: number; y: number; radius: number }) => void;
  legal: (arena: Arena, point: Vec, radius: number) => boolean;
  hurt: (sim: Simulation, player: Player, hit: { source: Vec; damage: number; blockable?: boolean }) => void;
  effect: (sim: Simulation, effect: Omit<Effect, 'id' | 'ttl'> & { id?: string }) => void;
}
interface TacticStep { dt: number; actions: EnemyActions }

function distance(a: Vec, b: Vec): number { const x = a.x - b.x; const y = a.y - b.y; return Math.hypot(x, y); }
function living(enemy: Enemy): boolean { return enemy.hp > 0 && enemy.state !== 'detonating' && enemy.state !== 'spent' && enemy.state !== 'escaped'; }
function targetPlayer(sim: Simulation, enemy: Enemy): Player | undefined {
  let target = sim.players.find(player => player.id === enemy.targetId && player.hp > 0);
  if (target) return target;
  let nearest = Infinity;
  for (const player of sim.players) {
    if (player.hp <= 0) continue;
    const separation = distance(player, enemy);
    if (separation < nearest) { nearest = separation; target = player; }
  }
  enemy.targetId = target?.id ?? ''; return target;
}
function approach(sim: Simulation, enemy: Enemy, step: TacticStep): void {
  const movement = { x: enemy.facingX * enemy.definition.speed * step.dt, y: enemy.facingY * enemy.definition.speed * step.dt, radius: enemy.radius };
  step.actions.move(sim, enemy, movement);
}
function face(enemy: Enemy, point: Vec): void {
  const separation = distance(enemy, point); if (separation < .001) return;
  enemy.facingX = (point.x - enemy.x) / separation; enemy.facingY = (point.y - enemy.y) / separation;
}

export function protectedBy(sim: Simulation, enemy: Enemy): Enemy | undefined {
  if (enemy.definition.behavior === 'protector' || enemy.definition.rank === 'boss') return undefined;
  return sim.enemies.find(protector => {
    if (!living(protector) || protector.linkId !== enemy.id) return false;
    const separation = distance(protector, enemy); return separation <= 5;
  });
}

function protectorStep(sim: Simulation, enemy: Enemy, step: TacticStep): void {
  enemy.linkWait = Math.max(0, (enemy.linkWait ?? 0) - step.dt);
  let ally = sim.enemies.find(item => item.id === enemy.linkId && living(item));
  const separation = ally ? distance(enemy, ally) : Infinity;
  if (enemy.linkId && (!ally || separation > 5)) {
    const effect = { id: `${enemy.id}-break-${enemy.attackCount ?? 0}`, x: enemy.x, y: enemy.y, radius: .7, kind: 'tactic-link-break', duration: .6 };
    step.actions.effect(sim, effect); enemy.linkId = ''; enemy.linkWait = 3; ally = undefined;
  }
  if (!ally && enemy.linkWait === 0) {
    let best = 3.5;
    for (const candidate of sim.enemies) {
      if (candidate === enemy || !living(candidate) || candidate.definition.behavior === 'protector' || candidate.definition.behavior === 'squirrel' || candidate.definition.rank === 'boss') continue;
      const protector = protectedBy(sim, candidate); if (protector) continue;
      const separation = distance(enemy, candidate);
      if (separation < best) { best = separation; ally = candidate; }
    }
    if (ally) { enemy.linkId = ally.id; enemy.attackCount = (enemy.attackCount ?? 0) + 1; }
    else enemy.linkWait = .5;
  }
  enemy.state = ally ? 'support' : 'chase';
  if (ally) { face(enemy, ally); return; }
  const target = targetPlayer(sim, enemy); if (!target) return;
  face(enemy, target); const range = distance(enemy, target);
  if (range > 3) approach(sim, enemy, step);
}

function chooseEscape(sim: Simulation, enemy: Enemy, step: TacticStep): void {
  const target = targetPlayer(sim, enemy); if (!target) return;
  const base = Math.atan2(enemy.y - target.y, enemy.x - target.x);
  let best = -Infinity; let destination: Vec = enemy;
  for (const offset of [0, .7, -.7, 1.4, -1.4, Math.PI]) {
    const angle = base + offset; const dx = Math.cos(angle); const dy = Math.sin(angle);
    const point = { x: enemy.x + dx * 2.5, y: enemy.y + dy * 2.5 };
    const valid = step.actions.legal(sim.arena, point, enemy.radius); if (!valid) continue;
    let score = Infinity;
    for (const player of sim.players) {
      if (player.hp <= 0) continue;
      const separation = distance(player, point); score = Math.min(score, separation);
    }
    if (score > best) { best = score; destination = point; }
  }
  enemy.attackX = destination.x; enemy.attackY = destination.y; face(enemy, destination);
}
function squirrelStep(sim: Simulation, enemy: Enemy, step: TacticStep): void {
  const target = targetPlayer(sim, enemy); if (!target) return;
  if (enemy.escapeLeft === undefined) {
    const separation = distance(enemy, target); if (separation > 7) { enemy.state = 'seek'; return; }
    enemy.escapeLeft = 18; enemy.timer = 0;
  }
  enemy.escapeLeft = Math.max(0, enemy.escapeLeft - step.dt);
  if (enemy.escapeLeft === 0) {
    const effect = { id: `${enemy.id}-escape`, x: enemy.x, y: enemy.y, radius: .8, kind: 'tactic-escape', duration: .8 };
    step.actions.effect(sim, effect); enemy.state = 'escaped'; if (!sim.presentationOnly) enemy.hp = 0; return;
  }
  enemy.timer -= step.dt;
  if (enemy.timer <= 0) {
    if (enemy.state === 'flee') { enemy.state = 'pause'; enemy.timer = .7; return; }
    chooseEscape(sim, enemy, step); enemy.state = 'flee'; enemy.timer = 1.1;
    enemy.originX = enemy.x; enemy.originY = enemy.y;
  }
  if (enemy.state !== 'flee') return;
  const previous = { x: enemy.x, y: enemy.y }; approach(sim, enemy, step);
  if (previous.x === enemy.x && previous.y === enemy.y) { enemy.state = 'pause'; enemy.timer = .3; }
}

function hazard(sim: Simulation, enemy: Enemy, kind: EnemyHazard['kind']): EnemyHazard {
  return { id: `${enemy.id}-${kind}-${enemy.attackCount}`, owner: enemy.id, kind, x: enemy.x, y: enemy.y, age: 0, delay: enemy.definition.windup, duration: 5, radius: 1.45, damage: enemy.definition.damage, angle: 0, gap: 70 * Math.PI / 180, sourceX: enemy.x, sourceY: enemy.y, hitIds: [] };
}
function addHazard(sim: Simulation, item: EnemyHazard): void {
  const exists = sim.hazards.some(hazard => hazard.id === item.id);
  if (!exists) sim.hazards.push(item);
}
function beginTactic(sim: Simulation, enemy: Enemy, step: TacticStep): boolean {
  const behavior = enemy.definition.behavior;
  if (behavior === 'sower') {
    const fields = sim.hazards.filter(item => item.kind === 'poison');
    const owned = fields.filter(item => item.owner === enemy.id);
    if (fields.length >= 6 || owned.length >= 2) return false;
    const item = hazard(sim, enemy, 'poison'); item.x = enemy.attackX ?? enemy.x; item.y = enemy.attackY ?? enemy.y;
    const valid = step.actions.legal(sim.arena, item, item.radius); if (!valid) return false;
    addHazard(sim, item);
  } else if (behavior === 'brood') {
    const children = sim.enemies.filter(item => item.parentId === enemy.id && living(item));
    const pending = sim.hazards.filter(item => item.owner === enemy.id && item.kind === 'egg');
    const total = enemy.summonCount ?? 0;
    const eggs = sim.hazards.filter(item => item.kind === 'egg');
    const childrenTotal = sim.enemies.filter(item => item.parentId && living(item)).length;
    const populationLimit = waveEnemyLimit(sim);
    const room = populationLimit - sim.enemies.length - eggs.length;
    const populationCap = 8 * Math.ceil(sim.partySize / 5);
    const space = Math.min(room, populationCap - childrenTotal - eggs.length);
    const limit = enemy.definition.rank === 'boss' ? 4 : enemy.definition.rank === 'elite' ? 3 : 2;
    const count = Math.min(limit, 4 - children.length - pending.length, 8 - total, space);
    if (count <= 0) return false;
    let created = 0;
    const base = Math.atan2(enemy.facingY, enemy.facingX);
    for (let index = 0; index < count; index += 1) {
      const angle = base + (index - (count - 1) / 2) * .9; const dx = Math.cos(angle); const dy = Math.sin(angle);
      const item = hazard(sim, enemy, 'egg'); item.id += `-${index}`; item.radius = .4; item.duration = .1;
      item.x += dx * 1.4; item.y += dy * 1.4;
      const valid = step.actions.legal(sim.arena, item, .35); if (!valid) continue;
      addHazard(sim, item); created += 1;
    }
    if (created === 0) return false;
    enemy.summonCount = total + created;
  } else if (behavior === 'moth') {
    const nearby = sim.hazards.some(item => { const separation = distance(item, enemy); return item.kind === 'echo' && separation < 10; });
    if (nearby) return false;
    const item = hazard(sim, enemy, 'echo'); item.radius = enemy.definition.reach; item.duration = item.radius / 2.4;
    item.angle = Math.atan2(enemy.facingY, enemy.facingX) + ((enemy.attackCount ?? 1) % 3 - 1) * .35;
    addHazard(sim, item);
  }
  enemy.state = 'channel'; enemy.timer = enemy.definition.windup; return true;
}

export function stepEnemyTactic(sim: Simulation, enemy: Enemy, step: TacticStep): boolean {
  const behavior = enemy.definition.behavior;
  if (!['sower', 'protector', 'brood', 'moth', 'squirrel'].includes(behavior ?? '')) return false;
  if (!living(enemy)) return true;
  if (behavior === 'protector') { protectorStep(sim, enemy, step); return true; }
  if (behavior === 'squirrel') { squirrelStep(sim, enemy, step); return true; }
  if (enemy.state === 'channel') {
    enemy.timer -= step.dt;
    if (enemy.timer <= 0) { enemy.state = 'recovery'; enemy.timer = enemy.definition.recovery; }
    return true;
  }
  if (enemy.state === 'recovery') { enemy.timer -= step.dt; if (enemy.timer > 0) return true; }
  const target = targetPlayer(sim, enemy); if (!target) return true;
  face(enemy, target); const range = distance(enemy, target);
  if (range > enemy.definition.reach) { enemy.state = 'chase'; approach(sim, enemy, step); return true; }
  enemy.attackX = target.x; enemy.attackY = target.y; enemy.attackCount = (enemy.attackCount ?? 0) + 1;
  const started = beginTactic(sim, enemy, step);
  if (!started) { enemy.state = 'recovery'; enemy.timer = 1; }
  return true;
}

function hatch(sim: Simulation, item: EnemyHazard, actions: EnemyActions): void {
  const populationLimit = waveEnemyLimit(sim);
  if (sim.presentationOnly || sim.enemies.length >= populationLimit || sim.spawned >= sim.config.maxSpawned) return;
  const parent = sim.enemies.find(enemy => enemy.id === item.owner && living(enemy)); if (!parent) return;
  const base = sim.config.enemies.find(enemy => enemy.kind === 'tree-normal'); if (!base) return;
  const valid = actions.legal(sim.arena, item, .32); if (!valid) return;
  const hp = base.hp * .6 * (parent.healthScale ?? 1); const damage = base.damage * .7 * (parent.damageScale ?? 1);
  const definition = { ...base, hp, radius: .32, damage };
  const child: Enemy = { id: `${item.id}-child`, x: item.x, y: item.y, kind: base.kind, radius: .32, hp, maxHp: hp, state: 'seek', facingX: 0, facingY: 1, timer: 0, targetId: '', definition, parentId: item.owner };
  sim.enemies.push(child); sim.spawned += 1;
  const effect = { id: `${item.id}-hatch`, x: item.x, y: item.y, radius: .6, kind: 'tactic-hatch', duration: .7 }; actions.effect(sim, effect);
}

export function stepEnemyHazards(sim: Simulation, dt: number, actions: EnemyActions): void {
  for (const player of sim.players) sim.poisonWait[player.id] = Math.max(0, (sim.poisonWait[player.id] ?? 0) - dt);
  const retained: EnemyHazard[] = [];
  for (const item of sim.hazards) {
    const previousAge = item.age; item.age += dt;
    const owner = sim.enemies.find(enemy => enemy.id === item.owner && living(enemy));
    if (item.kind === 'egg' && !owner) continue;
    if (item.kind === 'echo' && previousAge < item.delay && !owner) continue;
    if (item.age < item.delay) { retained.push(item); continue; }
    if (item.kind === 'egg') { hatch(sim, item, actions); continue; }
    if (item.age > item.delay + item.duration) continue;
    retained.push(item);
    if (sim.presentationOnly || item.kind !== 'echo') continue;
    const before = Math.max(0, previousAge - item.delay) * 2.4; const current = (item.age - item.delay) * 2.4;
    for (const player of sim.players) {
      if (player.hp <= 0 || item.hitIds.includes(player.id)) continue;
      const range = distance(player, item); if (range < before * .8 - .4 || range > current + .4) continue;
      const angle = Math.atan2(player.y - item.y, player.x - item.x) - item.angle;
      const sine = Math.sin(angle); const cosine = Math.cos(angle); const difference = Math.atan2(sine, cosine); const absolute = Math.abs(difference);
      if (absolute <= item.gap / 2) continue;
      item.hitIds.push(player.id); const hit = { source: item, damage: item.damage, blockable: true }; actions.hurt(sim, player, hit);
    }
  }
  sim.hazards = retained;
  if (sim.presentationOnly) return;
  // 同一时间只取重叠毒区的最高伤害，不因踩中多个区域叠加扣血。
  for (const player of sim.players) {
    if (player.hp <= 0 || sim.poisonWait[player.id] > 0) continue;
    let strongest: EnemyHazard | undefined;
    for (const item of retained) {
      if (item.kind !== 'poison' || item.age < item.delay) continue;
      const range = distance(player, item);
      if (range <= item.radius + .4 && (!strongest || item.damage > strongest.damage)) strongest = item;
    }
    if (!strongest) continue;
    sim.poisonWait[player.id] = 1; const hit = { source: strongest, damage: strongest.damage, blockable: false }; actions.hurt(sim, player, hit);
  }
}

export function rewardSquirrel(sim: Simulation, event: { enemy: Enemy; player?: Player }, actions: EnemyActions): void {
  if (event.enemy.definition.behavior !== 'squirrel' || !event.player || event.player.hp <= 0) return;
  const player = event.player; player.hp = Math.min(player.maxHp, player.hp + player.maxHp * .25);
  player.energy = Math.min(player.capacity, player.energy + player.capacity * .5);
  const effect = { id: `${event.enemy.id}-reward`, x: player.x, y: player.y, radius: .8, kind: 'tactic-heal', duration: 1.2 }; actions.effect(sim, effect);
}
