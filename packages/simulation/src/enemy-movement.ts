import type { Arena, Enemy, Simulation, Vec } from './index';
import type { EnemyActions } from './enemy-tactics';

interface EnemyStep { dt: number; actions: EnemyActions }
interface DirectedStep extends EnemyStep { direction: Vec; distance?: number }
interface ChaseStep extends EnemyStep { target: Vec }
interface RetreatStep extends ChaseStep { flank: boolean }

export function edgeClearance(arena: Arena, point: Vec, radius: number): number {
  return Math.min(point.x - radius, point.y - radius, arena.width - point.x - radius, arena.height - point.y - radius);
}

export function enemyPathClear(sim: Simulation, enemy: Enemy, path: { point: Vec; actions: EnemyActions }): boolean {
  const dx = path.point.x - enemy.x; const dy = path.point.y - enemy.y;
  const length = Math.hypot(dx, dy); const slices = Math.ceil(length / .2);
  for (let index = 1; index <= slices; index += 1) {
    const point = { x: enemy.x + dx * index / slices, y: enemy.y + dy * index / slices };
    const valid = path.actions.legal(sim.arena, point, enemy.radius); if (!valid) return false;
  }
  return true;
}

export function moveEnemy(sim: Simulation, enemy: Enemy, step: DirectedStep): boolean {
  const slow = (enemy.slowUntil ?? 0) > sim.clock ? 1 - (enemy.slowFactor ?? 0) : 1;
  const speed = enemy.definition.speed * slow;
  const length = Math.hypot(step.direction.x, step.direction.y); if (length < .001) return false;
  const maximum = step.distance ?? Infinity; const travel = Math.min(speed * step.dt, maximum);
  const movement = { x: step.direction.x / length * travel, y: step.direction.y / length * travel, radius: enemy.radius };
  const before = { x: enemy.x, y: enemy.y };
  step.actions.move(sim, enemy, movement);
  return enemy.x !== before.x || enemy.y !== before.y;
}

export function approachEnemy(sim: Simulation, enemy: Enemy, step: ChaseStep): boolean {
  const dx = step.target.x - enemy.x; const dy = step.target.y - enemy.y;
  const separation = Math.hypot(dx, dy); if (separation < .02) return false;
  const base = Math.atan2(enemy.facingY, enemy.facingX); const probe = Math.min(.8, separation);
  let direction: Vec | undefined; let best = -Infinity;
  for (const offset of [0, .7, -.7, 1.4, -1.4, 2.1, -2.1, Math.PI]) {
    const angle = base + offset; const x = Math.cos(angle); const y = Math.sin(angle);
    const point = { x: enemy.x + x * probe, y: enemy.y + y * probe };
    const path = { point, actions: step.actions }; const clear = enemyPathClear(sim, enemy, path); if (!clear) continue;
    if (offset === 0) { direction = { x, y }; break; }
    const remaining = Math.hypot(step.target.x - point.x, step.target.y - point.y);
    const score = separation - remaining;
    if (score > best) { best = score; direction = { x, y }; }
  }
  if (!direction) return false;
  const movement = { ...step, direction, distance: separation };
  return moveEnemy(sim, enemy, movement);
}

export function retreatEnemy(sim: Simulation, enemy: Enemy, step: RetreatStep): boolean {
  const dx = enemy.x - step.target.x; const dy = enemy.y - step.target.y;
  const away = Math.atan2(dy, dx); const base = step.flank ? away + Math.PI / 2 : away;
  const probe = Math.max(.6, enemy.definition.speed * .7);
  let direction: Vec | undefined; let best = -Infinity;
  for (const offset of [0, .7, -.7, 1.4, -1.4, 2.1, -2.1, Math.PI]) {
    const angle = base + offset; const x = Math.cos(angle); const y = Math.sin(angle);
    const point = { x: enemy.x + x * probe, y: enemy.y + y * probe };
    const path = { point, actions: step.actions }; const clear = enemyPathClear(sim, enemy, path); if (!clear) continue;
    const clearance = edgeClearance(sim.arena, point, enemy.radius); const edge = Math.min(0, clearance - 2);
    const distance = Math.hypot(point.x - step.target.x, point.y - step.target.y);
    const range = Math.min(distance, enemy.definition.reach);
    const preference = Math.cos(offset); const score = edge * 3 + range * .5 + preference;
    if (score > best) { best = score; direction = { x, y }; }
  }
  if (!direction) return false;
  const movement = { ...step, direction };
  return moveEnemy(sim, enemy, movement);
}
