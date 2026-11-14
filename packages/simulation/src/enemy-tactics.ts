import type { Arena, Effect, Enemy, Player, Simulation, Vec } from './index';
import { beginEnemyCycle, canBeginEnemyAttack, enemyAbilities, enemyRank, enemyTarget, faceEnemy } from './enemy-abilities';
import { queueEnemyHazard } from './enemy-hazards';
import { approachEnemy, edgeClearance, enemyPathClear } from './enemy-movement';
export { stepEnemyHazards } from './enemy-hazards';
export type { EnemyHazard } from './enemy-hazards';

export interface EnemyActions {
  move: (sim: Simulation, entity: Vec, movement: { x: number; y: number; radius: number }) => void;
  legal: (arena: Arena, point: Vec, radius: number) => boolean;
  hurt: (sim: Simulation, player: Player, hit: { source: Vec; damage: number; blockable?: boolean }) => void;
  effect: (sim: Simulation, effect: Omit<Effect, 'id' | 'ttl'> & { id?: string }) => void;
  detonate: (sim: Simulation, enemy: Enemy) => void;
}
interface TacticStep { dt: number; actions: EnemyActions }
function distance(a: Vec, b: Vec): number { const x = a.x - b.x; const y = a.y - b.y; return Math.hypot(x, y); }
function living(enemy: Enemy): boolean { return enemy.hp > 0 && enemy.state !== 'detonating' && enemy.state !== 'spent' && enemy.state !== 'escaped'; }
function approach(sim: Simulation, enemy: Enemy, step: TacticStep): void {
  const target = enemy.state === 'flee' ? { x: enemy.attackX ?? enemy.x, y: enemy.attackY ?? enemy.y } : enemyTarget(sim, enemy);
  if (!target) return;
  const movement = { ...step, target }; approachEnemy(sim, enemy, movement);
}

export function protectedBy(sim: Simulation, enemy: Enemy): Enemy | undefined {
  if (enemy.definition.behavior === 'protector' || enemy.definition.rank === 'boss' || enemy.definition.behavior === 'squirrel') return;
  return sim.enemies.find(protector => {
    if (!living(protector) || protector.definition.behavior !== 'protector' || protector.state !== 'support') return false;
    const linked = protector.abilities?.links.includes(enemy.id) || protector.linkId === enemy.id;
    const separation = distance(protector, enemy); return linked && separation <= 5;
  });
}

function breakLinks(sim: Simulation, enemy: Enemy, step: TacticStep): void {
  const ability = enemyAbilities(enemy);
  if (ability.links.length) {
    const effect = { id: `${enemy.id}-break-${enemy.attackCount}`, x: enemy.x, y: enemy.y, radius: enemy.radius + .3, kind: 'tactic-link-break', duration: .6 }; step.actions.effect(sim, effect);
  }
  ability.links = []; enemy.linkId = ''; enemy.linkWait = 3;
}

function protectorStep(sim: Simulation, enemy: Enemy, step: TacticStep): void {
  const ability = enemyAbilities(enemy); const rank = enemyRank(enemy);
  enemy.linkWait = Math.max(0, (enemy.linkWait ?? 0) - step.dt);
  if (enemy.state === 'support') {
    ability.supportWait -= step.dt;
    ability.links = ability.links.filter(id => {
      const ally = sim.enemies.find(item => item.id === id && living(item));
      const separation = ally ? distance(enemy, ally) : Infinity; return separation <= 5;
    });
    enemy.linkId = ability.links[0] ?? '';
    if (ability.links.length && (rank === 0 || ability.supportWait > 0)) return;
    if (rank === 2) for (const id of ability.links) {
      const ally = sim.enemies.find(item => item.id === id); if (!ally) continue;
      const length = distance(enemy, ally); const angle = Math.atan2(ally.y - enemy.y, ally.x - enemy.x);
      const plan = { kind: 'root' as const, x: (enemy.x + ally.x) / 2, y: (enemy.y + ally.y) / 2, radius: .6, length, width: .65, angle, delay: 1.4 };
      queueEnemyHazard(sim, enemy, plan);
    }
    breakLinks(sim, enemy, step); enemy.state = 'recovery'; enemy.timer = 3; return;
  }
  if (enemy.state === 'recovery' || enemy.state === 'channel') { enemy.timer -= step.dt; if (enemy.timer > 0) return; enemy.state = 'chase'; }
  const target = enemyTarget(sim, enemy); if (!target) return;
  if (enemy.linkWait === 0) {
    const candidates = sim.enemies.filter(candidate => {
      if (candidate === enemy || !living(candidate) || candidate.definition.behavior === 'protector' || candidate.definition.behavior === 'squirrel' || candidate.definition.rank === 'boss') return false;
      const protectedAlready = protectedBy(sim, candidate); const range = distance(enemy, candidate); return !protectedAlready && range <= 3.5;
    });
    candidates.sort((a, b) => {
      const first = distance(enemy, a); const second = distance(enemy, b);
      const firstRank = enemyRank(a); const secondRank = enemyRank(b);
      return ability.tier > 0 && firstRank !== secondRank ? secondRank - firstRank : first - second;
    });
    if (rank === 1 && ability.cycle % 2 === 1 && candidates.length > 1) { const first = candidates.shift(); if (first) candidates.push(first); }
    const count = rank === 2 ? 2 : 1; ability.links = candidates.slice(0, count).map(item => item.id);
    if (ability.links.length) {
      beginEnemyCycle(enemy); enemy.attackCount = (enemy.attackCount ?? 0) + 1;
      enemy.linkId = ability.links[0]; enemy.state = 'support'; ability.supportWait = rank === 2 ? 6 - ability.phase : 7; return;
    }
    enemy.linkWait = 1;
  }
  faceEnemy(enemy, target); const separation = distance(enemy, target);
  if (separation > 3.5) { enemy.state = 'chase'; approach(sim, enemy, step); return; }
  const available = canBeginEnemyAttack(sim, enemy); if (!available) return;
  beginEnemyCycle(enemy); enemy.attackCount = (enemy.attackCount ?? 0) + 1;
  const angle = Math.atan2(enemy.facingY, enemy.facingX);
  const plan = { kind: 'root' as const, x: enemy.x + enemy.facingX * 1.8, y: enemy.y + enemy.facingY * 1.8, radius: .6, length: 2.4, width: .65, angle, delay: 1.4 };
  queueEnemyHazard(sim, enemy, plan); enemy.state = 'channel'; enemy.timer = 3;
}

function chooseEscape(sim: Simulation, enemy: Enemy, step: TacticStep): void {
  const target = enemyTarget(sim, enemy); if (!target) return;
  const ability = enemyAbilities(enemy); const base = Math.atan2(enemy.y - target.y, enemy.x - target.x);
  const variation = ability.tier > 0 ? .2 * (ability.cycle % 3 - 1) : 0;
  let best = -Infinity; let destination: Vec = enemy;
  for (const offset of [0, .7, -.7, 1.4, -1.4, 2.1, -2.1, Math.PI]) {
    const angle = base + offset + variation; const dx = Math.cos(angle); const dy = Math.sin(angle);
    const point = { x: enemy.x + dx * 2.5, y: enemy.y + dy * 2.5 };
    const path = { point, actions: step.actions }; const valid = enemyPathClear(sim, enemy, path); if (!valid) continue;
    let score = Infinity;
    for (const player of sim.players) { if (player.hp <= 0) continue; const separation = distance(player, point); score = Math.min(score, separation); }
    const clearance = edgeClearance(sim.arena, point, enemy.radius); const edge = Math.min(0, clearance - 2);
    score += edge * 3;
    if (score > best) { best = score; destination = point; }
  }
  enemy.attackX = destination.x; enemy.attackY = destination.y; faceEnemy(enemy, destination); ability.cycle += 1;
}

function squirrelStep(sim: Simulation, enemy: Enemy, step: TacticStep): void {
  const target = enemyTarget(sim, enemy); if (!target) return;
  const ability = enemyAbilities(enemy); const rank = enemyRank(enemy);
  if (enemy.escapeLeft === undefined) {
    const separation = distance(enemy, target); if (separation > 7) { enemy.state = 'seek'; return; }
    enemy.escapeLeft = rank === 2 ? 32 : rank === 1 ? 24 : 18; enemy.timer = 0;
  }
  enemy.escapeLeft = Math.max(0, enemy.escapeLeft - step.dt);
  if (enemy.escapeLeft === 0) {
    const effect = { id: `${enemy.id}-escape`, x: enemy.x, y: enemy.y, radius: enemy.radius + .3, kind: 'tactic-escape', duration: .8 };
    step.actions.effect(sim, effect); enemy.state = 'escaped'; if (!sim.presentationOnly) enemy.hp = 0; return;
  }
  enemy.timer -= step.dt;
  if (enemy.timer <= 0) {
    if (enemy.state === 'flee') {
      ability.step += 1; const bursts = rank === 0 ? 1 : rank === 1 ? 2 : 3;
      if (ability.step >= bursts) { enemy.state = 'pause'; enemy.timer = rank === 2 ? 2.8 : rank === 1 ? 1.5 : .7; ability.step = 0; return; }
    }
    chooseEscape(sim, enemy, step); enemy.state = 'flee'; enemy.timer = rank === 2 ? .65 : rank === 1 ? .85 : 1.1;
    enemy.originX = enemy.x; enemy.originY = enemy.y;
  }
  if (enemy.state !== 'flee') return;
  const destination = { x: enemy.attackX ?? enemy.x, y: enemy.attackY ?? enemy.y }; faceEnemy(enemy, destination);
  const previous = { x: enemy.x, y: enemy.y }; approach(sim, enemy, step);
  if (previous.x === enemy.x && previous.y === enemy.y) { enemy.state = 'pause'; enemy.timer = rank > 0 ? 1.5 : .7; ability.step = 0; }
}

function sow(sim: Simulation, enemy: Enemy, step: TacticStep): void {
  const target = enemyTarget(sim, enemy); if (!target) return;
  const ability = enemyAbilities(enemy); const rank = enemyRank(enemy);
  const owned = sim.hazards.filter(item => item.owner === enemy.id && item.kind === 'poison'); const cap = rank === 2 ? 3 : 2;
  if (owned.length >= cap) { const oldest = owned[0]; sim.hazards = sim.hazards.filter(item => item.id !== oldest.id); }
  const rotation = ability.phase > 0 ? -1 : 1;
  const angle = (ability.cycle * .9 + ability.step * 2.1) * rotation; const offset = rank === 2 ? 1.4 : ability.tier * .2; const dx = Math.cos(angle); const dy = Math.sin(angle);
  const plan = { kind: 'poison' as const, x: target.x + dx * offset, y: target.y + dy * offset, radius: 1.35, delay: enemy.definition.windup, duration: rank === 2 ? 5.5 : 5 };
  const valid = step.actions.legal(sim.arena, plan, plan.radius); if (valid) queueEnemyHazard(sim, enemy, plan);
}

function layEggs(sim: Simulation, enemy: Enemy, step: TacticStep): boolean {
  const ability = enemyAbilities(enemy); const rank = enemyRank(enemy);
  const children = sim.enemies.filter(item => item.parentId === enemy.id && living(item));
  const pending = sim.hazards.filter(item => item.owner === enemy.id && item.kind === 'egg');
  const lifetimeCap = rank === 2 ? 24 : rank === 1 ? 12 : 8;
  const count = Math.min(rank + 2, 4 - children.length - pending.length, lifetimeCap - (enemy.summonCount ?? 0));
  const directionStep = ability.phase > 0 ? -.4 : .4;
  const angle = Math.atan2(enemy.facingY, enemy.facingX) + (ability.tier > 0 ? ability.cycle * directionStep : 0); let created = 0;
  for (let index = 0; index < count; index += 1) {
    const direction = angle + (index - (count - 1) / 2) * .9; const dx = Math.cos(direction); const dy = Math.sin(direction);
    const plan = { kind: 'egg' as const, x: enemy.x + dx * (enemy.radius + 1), y: enemy.y + dy * (enemy.radius + 1), radius: .4, delay: enemy.definition.windup + (rank > 0 ? index * .8 : 0), duration: .1 };
    const valid = step.actions.legal(sim.arena, plan, .4); if (!valid) continue;
    const queued = queueEnemyHazard(sim, enemy, plan); if (queued) created += 1;
  }
  enemy.summonCount = (enemy.summonCount ?? 0) + created; return created > 0;
}

function echo(sim: Simulation, enemy: Enemy): boolean {
  const ability = enemyAbilities(enemy); const rank = enemyRank(enemy); const count = rank === 2 ? 3 + ability.phase : rank === 1 ? 2 : 1;
  const angle = Math.atan2(enemy.facingY, enemy.facingX); const reverse = ability.tier >= 2 && ability.cycle % 2 === 0 ? -1 : 1; let created = false;
  for (let index = 0; index < count; index += 1) {
    const radius = enemy.definition.reach; const direction = angle + reverse * index * .22;
    const plan = { kind: 'echo' as const, x: enemy.x, y: enemy.y, radius, delay: enemy.definition.windup + index * 1.8, duration: radius / 2.4, angle: direction, gap: Math.PI * .62 };
    const queued = queueEnemyHazard(sim, enemy, plan); created = queued || created;
  }
  return created;
}

export function stepEnemyTactic(sim: Simulation, enemy: Enemy, step: TacticStep): boolean {
  const behavior = enemy.definition.behavior;
  if (!['sower', 'protector', 'brood', 'moth', 'squirrel'].includes(behavior ?? '')) return false;
  if (!living(enemy)) return true;
  if (behavior === 'protector') { protectorStep(sim, enemy, step); return true; }
  if (behavior === 'squirrel') { squirrelStep(sim, enemy, step); return true; }
  const ability = enemyAbilities(enemy); const rank = enemyRank(enemy);
  if (enemy.state === 'channel') {
    enemy.timer -= step.dt; if (enemy.timer > 0) return true;
    if (behavior === 'sower' && ability.step < rank) { ability.step += 1; sow(sim, enemy, step); enemy.timer = enemy.definition.windup; return true; }
    enemy.state = 'recovery'; enemy.timer = enemy.definition.recovery + (rank === 2 ? 1.5 : 0); return true;
  }
  if (enemy.state === 'recovery') { enemy.timer -= step.dt; if (enemy.timer > 0) return true; }
  const target = enemyTarget(sim, enemy); if (!target) return true;
  faceEnemy(enemy, target); const range = distance(enemy, target);
  if (range > enemy.definition.reach) { enemy.state = 'chase'; approach(sim, enemy, step); return true; }
  const available = canBeginEnemyAttack(sim, enemy); if (!available) { enemy.state = 'chase'; return true; }
  beginEnemyCycle(enemy); enemy.attackX = target.x; enemy.attackY = target.y; enemy.attackCount = (enemy.attackCount ?? 0) + 1; let started = true;
  if (behavior === 'sower') sow(sim, enemy, step);
  if (behavior === 'brood') started = layEggs(sim, enemy, step);
  if (behavior === 'moth') started = echo(sim, enemy);
  enemy.state = started ? 'channel' : 'recovery';
  enemy.timer = started ? enemy.definition.windup + (behavior === 'moth' ? (rank === 2 ? 5.4 : rank === 1 ? 1.8 : 0) : behavior === 'brood' ? rank * .8 : 0) : 1;
  return true;
}

export function rewardSquirrel(sim: Simulation, event: { enemy: Enemy; player?: Player }, actions: EnemyActions): void {
  if (event.enemy.definition.behavior !== 'squirrel' || !event.player || event.player.hp <= 0) return;
  const player = event.player; player.hp = Math.min(player.maxHp, player.hp + player.maxHp * .25); player.energy = Math.min(player.capacity, player.energy + player.capacity * .5);
  const effect = { id: `${event.enemy.id}-reward`, x: player.x, y: player.y, radius: .8, kind: 'tactic-heal', duration: 1.2 }; actions.effect(sim, effect);
}
