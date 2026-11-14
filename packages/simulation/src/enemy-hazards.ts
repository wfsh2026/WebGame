import type { Enemy, Simulation, Vec } from './index';
import type { EnemyActions } from './enemy-tactics';

export interface EnemyHazard extends Vec {
  id: string; owner: string; kind: 'poison' | 'egg' | 'echo' | 'root' | 'blast' | 'ring';
  age: number; delay: number; duration: number; radius: number; damage: number;
  angle: number; gap: number; sourceX: number; sourceY: number; hitIds: string[];
  innerRadius?: number; length?: number; width?: number; persistent?: boolean;
}
export interface HazardPlan extends Vec {
  kind: EnemyHazard['kind']; radius: number; delay: number; duration?: number;
  angle?: number; gap?: number; innerRadius?: number; length?: number; width?: number; persistent?: boolean;
}

export function queueEnemyHazard(sim: Simulation, enemy: Enemy, plan: HazardPlan): boolean {
  if (sim.presentationOnly || sim.hazards.length >= 80) return false;
  const same = sim.hazards.filter(item => item.kind === plan.kind);
  const limits = { poison: 6, egg: 12, echo: 4, root: 16, blast: 12, ring: 4 };
  if (same.length >= limits[plan.kind]) return false;
  if (plan.kind === 'echo') {
    const conflict = same.some(item => {
      const dx = item.x - plan.x; const dy = item.y - plan.y;
      return item.owner !== enemy.id && dx * dx + dy * dy < 144;
    });
    if (conflict) return false;
  }
  const margin = plan.kind === 'egg' || plan.kind === 'poison' ? plan.radius : .2;
  if (plan.x < margin || plan.y < margin || plan.x > sim.arena.width - margin || plan.y > sim.arena.height - margin) return false;
  sim.nextId += 1;
  const item: EnemyHazard = { ...plan, id: `${enemy.id}-hazard-${sim.nextId}`, owner: enemy.id, age: 0, delay: plan.delay, duration: plan.duration ?? .35, damage: enemy.definition.damage, angle: plan.angle ?? 0, gap: plan.gap ?? 0, sourceX: enemy.x, sourceY: enemy.y, hitIds: [] };
  sim.hazards.push(item); return true;
}

function hatch(sim: Simulation, item: EnemyHazard, actions: EnemyActions): void {
  const parent = sim.enemies.find(enemy => enemy.id === item.owner && enemy.hp > 0);
  const base = sim.config.enemies.find(enemy => enemy.kind === 'tree-normal');
  if (!parent || !base) return;
  const valid = actions.legal(sim.arena, item, .32); if (!valid) return;
  const hp = base.hp * .6 * (parent.healthScale ?? 1); const damage = base.damage * .7 * (parent.damageScale ?? 1);
  const definition = { ...base, hp, radius: .32, damage };
  const split = item.id.lastIndexOf('-'); const suffix = item.id.slice(split + 1); const variant = Number(suffix);
  const alternate = (parent.abilities?.tier ?? 0) >= 2 && variant % 3 === 0;
  const runner = alternate ? sim.config.enemies.find(enemy => enemy.kind === 'wolf-normal') : undefined;
  if (runner) { definition.behavior = runner.behavior; definition.kind = runner.kind; definition.speed = runner.speed; definition.reach = runner.reach; definition.windup = runner.windup; definition.recovery = runner.recovery; }
  const child: Enemy = { id: `${item.id}-child`, x: item.x, y: item.y, kind: definition.kind, radius: .32, hp, maxHp: hp, state: 'seek', facingX: 0, facingY: 1, timer: 0, targetId: '', definition, parentId: item.owner, bornWave: parent.bornWave, expiresAt: sim.clock + 24 };
  sim.enemies.push(child); sim.spawned += 1;
  const effect = { id: `${item.id}-hatch`, x: item.x, y: item.y, radius: .6, kind: 'tactic-hatch', duration: .7 }; actions.effect(sim, effect);
}

function contains(item: EnemyHazard, point: Vec, previousAge: number): boolean {
  const dx = point.x - item.x; const dy = point.y - item.y; const range = Math.hypot(dx, dy);
  if (item.kind === 'root') {
    const cosine = Math.cos(item.angle); const sine = Math.sin(item.angle);
    const along = dx * cosine + dy * sine; const across = -dx * sine + dy * cosine;
    return Math.abs(along) <= (item.length ?? item.radius * 2) / 2 + .4 && Math.abs(across) <= (item.width ?? .7) / 2 + .4;
  }
  if (item.kind === 'ring') return range + .4 >= (item.innerRadius ?? 0) && range - .4 <= item.radius;
  if (item.kind !== 'echo') return range <= item.radius + .4;
  const before = Math.max(0, previousAge - item.delay) * 2.4; const current = Math.min(item.radius, (item.age - item.delay) * 2.4);
  if (range < before - .55 || range > current + .55) return false;
  const difference = Math.atan2(dy, dx) - item.angle;
  const sine = Math.sin(difference); const cosine = Math.cos(difference); const wrapped = Math.atan2(sine, cosine); const absolute = Math.abs(wrapped);
  const safeRange = Math.max(.4, range); const ratio = Math.min(1, .4 / safeRange); const clearance = Math.asin(ratio);
  return absolute > item.gap / 2 - clearance;
}

export function stepEnemyHazards(sim: Simulation, dt: number, actions: EnemyActions): void {
  for (const player of sim.players) sim.poisonWait[player.id] = Math.max(0, (sim.poisonWait[player.id] ?? 0) - dt);
  const retained: EnemyHazard[] = [];
  for (const item of sim.hazards) {
    const previousAge = item.age; item.age += dt;
    const owner = sim.enemies.find(enemy => enemy.id === item.owner && enemy.hp > 0 && enemy.state !== 'spent');
    if (!owner && (item.kind === 'egg' || (previousAge < item.delay && !item.persistent))) continue;
    if (item.age < item.delay) { retained.push(item); continue; }
    if (item.kind === 'egg') { hatch(sim, item, actions); continue; }
    const expired = item.age > item.delay + item.duration;
    if (!expired) retained.push(item);
    if (item.kind === 'poison' || previousAge > item.delay + item.duration) continue;
    for (const player of sim.players) {
      if (player.hp <= 0 || item.hitIds.includes(player.id)) continue;
      const hit = contains(item, player, previousAge); if (!hit) continue;
      item.hitIds.push(player.id);
      const source = item.kind === 'root' ? { x: item.sourceX, y: item.sourceY } : item;
      const impact = { source, damage: item.damage, blockable: true }; actions.hurt(sim, player, impact);
    }
  }
  sim.hazards = retained;
  for (const player of sim.players) {
    if (player.hp <= 0 || sim.poisonWait[player.id] > 0) continue;
    let strongest: EnemyHazard | undefined;
    for (const item of retained) {
      if (item.kind !== 'poison' || item.age < item.delay) continue;
      const dx = item.x - player.x; const dy = item.y - player.y; const radius = item.radius + .4;
      if (dx * dx + dy * dy <= radius * radius && (!strongest || item.damage > strongest.damage)) strongest = item;
    }
    if (!strongest) continue;
    sim.poisonWait[player.id] = 1; const impact = { source: strongest, damage: strongest.damage, blockable: false }; actions.hurt(sim, player, impact);
  }
}
