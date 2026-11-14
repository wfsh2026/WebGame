import { bannerAttackDamage, bannerAttackPattern } from './banners';
import type { Effect, Enemy, Player, Simulation, Vec, Arena } from './index';
import type { SpatialEnemies } from './spatial-enemies';

interface BannerActions {
  hurt: (sim: Simulation, hit: { enemy: Enemy; player: Player; damage: number; source: Vec; flavor: string; castId: string }) => void;
  legal: (arena: Arena, position: Vec, radius: number) => boolean;
  segmentDistance: (point: Vec, segment: { from: Vec; to: Vec }) => number;
  enemies: SpatialEnemies;
}
interface Coverage { flag: Effect; power: number }
interface CombatContext { dt: number; flags: Effect[]; overlaps: Map<string, Coverage[]>; hits: Map<string, Set<string>>; actions: BannerActions }

function living(enemy: Enemy): boolean { return enemy.hp > 0 && enemy.state !== 'escaped' && enemy.state !== 'detonating'; }
function separation(a: Vec, b: Vec): number { const x = a.x - b.x; const y = a.y - b.y; return Math.hypot(x, y); }
function attackPower(sim: Simulation, flag: Effect): number {
  const data = flag.banner;
  if (!data) return 0;
  const owner = sim.players.find(player => player.id === flag.owner);
  const branch = owner?.equipment.branches.find(entry => entry.item.id === flag.sourceId);
  if (!owner || !branch) return 0;
  const base = flag.damage ?? bannerAttackDamage(branch, owner.stats.magicalAttack);
  const age = (flag.duration ?? 0) - flag.ttl;
  let multiplier = data.tail > 0 ? Math.min(1, flag.ttl / data.tail) : 1;
  if ((flag.level ?? 1) >= 20 && (age - data.warmup) % 6 < 1.5) multiplier *= 1.3;
  if ((data.levels.overload ?? 0) >= 5 && age < 2) multiplier *= 1.15;
  const focus = owner.banners?.buffs.find(buff => buff.fieldId === flag.id && buff.inside && buff.held >= 3);
  if (focus && (data.levels.concentrate ?? 0) >= 10) multiplier *= (data.levels.concentrate ?? 0) >= 20 ? 1.2 : 1.1;
  return base * multiplier;
}
function startAttack(sim: Simulation, flag: Effect, counter = false): boolean {
  const data = flag.banner;
  if (!data) return false;
  const pattern = bannerAttackPattern(flag.kind);
  const targets = sim.enemies.filter(enemy => {
    if (!living(enemy)) return false;
    const distance = separation(enemy, flag);
    return distance <= flag.radius + enemy.radius;
  });
  if (!targets.length) return false;
  const age = (flag.duration ?? 0) - flag.ttl - data.warmup;
  const empowered = counter || (flag.level ?? 1) >= 20 && age % 6 < 1.5;
  const multiplier = counter ? 1.5 : 1;
  const damage = attackPower(sim, flag) * multiplier;
  const sequence = (data.attacks ?? 0) + 1;
  data.attacks = sequence;
  const id = `${flag.id}-attack-${sequence}`;
  const epoch = data.attackEpoch ?? sim.clock;
  const cycle = Math.floor((sim.clock - epoch + .000001) / pattern.interval);
  const castId = counter ? id : `banner-group-${flag.owner}-${flag.kind}-${epoch}-${cycle}`;
  let duration = pattern.duration;
  let facingX = 0; let facingY = 0;
  if (pattern.speed > 0) {
    let target = targets[0]; let nearest = separation(target, flag);
    for (const candidate of targets) {
      const distance = separation(candidate, flag);
      if (distance < nearest) { target = candidate; nearest = distance; }
    }
    const dx = target.x - flag.x; const dy = target.y - flag.y;
    const distance = Math.hypot(dx, dy);
    facingX = distance > .001 ? dx / distance : 1;
    facingY = distance > .001 ? dy / distance : 0;
    duration = flag.radius / pattern.speed;
  }
  const kind = pattern.speed > 0 ? 'banner-bolt' : 'banner-wave';
  const attack: Effect = { id, kind, flavor: flag.kind, castId, groupId: flag.id, owner: flag.owner, sourceId: flag.sourceId, level: flag.level, x: flag.x, y: flag.y, radius: flag.radius, width: pattern.width, facingX, facingY, damage, empowered, hitIds: [], duration, ttl: duration };
  if (!sim.effects.some(effect => effect.id === id)) sim.effects.push(attack);
  return true;
}
function strongestField(hit: { flag: Effect; enemy: Enemy; attack: Effect }, coverage: Coverage[]): boolean {
  const { flag, enemy, attack } = hit;
  const current = coverage.find(entry => entry.flag.id === flag.id);
  const power = attack.castId === attack.id ? attack.damage ?? 0 : current?.power ?? 0;
  for (const entry of coverage) {
    const other = entry.flag;
    if (other.id === flag.id || other.owner !== flag.owner || other.kind !== flag.kind || other.ttl <= 0 || !other.banner) continue;
    const age = (other.duration ?? 0) - other.ttl;
    if (age < other.banner.warmup) continue;
    const distance = separation(other, enemy);
    if (distance > other.radius + enemy.radius) continue;
    const competing = entry.power;
    if (competing > power || competing === power && other.id < flag.id) return false;
  }
  return true;
}
function hitTarget(sim: Simulation, hit: { attack: Effect; enemy: Enemy; flag: Effect; player: Player }, context: CombatContext): void {
  const { attack, enemy, flag, player } = hit;
  const key = `${flag.owner}:${flag.kind}`;
  const overlapping = context.overlaps.get(key) ?? [];
  const strongest = strongestField(hit, overlapping);
  if (!strongest) return;
  const castId = attack.castId ?? attack.id;
  const pattern = bannerAttackPattern(flag.kind);
  const group = sim.castHits[castId] ?? { ids: [], until: sim.clock + pattern.interval + 1 };
  let hits = context.hits.get(castId);
  if (!hits) { hits = new Set(group.ids); context.hits.set(castId, hits); }
  if (hits.has(enemy.id)) return;
  hits.add(enemy.id); group.ids.push(enemy.id); sim.castHits[castId] = group;
  const event = { enemy, player, damage: attack.damage ?? 0, source: flag, flavor: flag.kind, castId: attack.id };
  context.actions.hurt(sim, event);
}
function stepWave(sim: Simulation, attack: Effect, context: CombatContext): void {
  const duration = attack.duration ?? .4;
  const elapsed = duration - attack.ttl;
  const before = Math.max(0, elapsed / duration);
  const after = Math.min(1, (elapsed + context.dt) / duration);
  const inward = attack.flavor === 'banner-energy';
  const oldRadius = attack.radius * (inward ? 1 - before : before);
  const newRadius = attack.radius * (inward ? 1 - after : after);
  const lower = Math.min(oldRadius, newRadius) - (attack.width ?? .4) / 2;
  const upper = Math.max(oldRadius, newRadius) + (attack.width ?? .4) / 2;
  const flag = context.flags.find(field => field.id === attack.groupId && field.ttl > 0);
  const player = sim.players.find(entry => entry.id === attack.owner);
  if (!flag || !player) { attack.ttl = 0; return; }
  const minimum = { x: attack.x - attack.radius, y: attack.y - attack.radius };
  const maximum = { x: attack.x + attack.radius, y: attack.y + attack.radius };
  const candidates = context.actions.enemies.segment(minimum, maximum);
  attack.hitIds ??= [];
  const hitIds = new Set(attack.hitIds);
  for (const enemy of candidates) {
    if (!living(enemy) || hitIds.has(enemy.id)) continue;
    const distance = separation(enemy, attack);
    if (distance > attack.radius + enemy.radius || distance - enemy.radius > upper || distance + enemy.radius < lower) continue;
    attack.hitIds.push(enemy.id); hitIds.add(enemy.id);
    const hit = { attack, enemy, flag, player };
    hitTarget(sim, hit, context);
  }
}
function stepBolt(sim: Simulation, attack: Effect, context: CombatContext): void {
  const duration = attack.duration ?? 1;
  const before = Math.max(0, (duration - attack.ttl) / duration);
  const after = Math.min(1, before + context.dt / duration);
  const dx = (attack.facingX ?? 1) * attack.radius;
  const dy = (attack.facingY ?? 0) * attack.radius;
  const from = { x: attack.x + dx * before, y: attack.y + dy * before };
  let to = from;
  const travelled = attack.radius * (after - before);
  const count = Math.ceil(travelled / .08); const slices = Math.max(1, count);
  const radius = (attack.width ?? .2) / 2;
  for (let index = 1; index <= slices; index += 1) {
    const progress = before + (after - before) * index / slices;
    const position = { x: attack.x + dx * progress, y: attack.y + dy * progress };
    const legal = context.actions.legal(sim.arena, position, radius);
    if (!legal) { attack.ttl = 0; break; }
    to = position;
  }
  const flag = context.flags.find(field => field.id === attack.groupId && field.ttl > 0);
  const player = sim.players.find(entry => entry.id === attack.owner);
  if (!flag || !player) { attack.ttl = 0; return; }
  const minimum = { x: Math.min(from.x, to.x) - radius, y: Math.min(from.y, to.y) - radius };
  const maximum = { x: Math.max(from.x, to.x) + radius, y: Math.max(from.y, to.y) + radius };
  const candidates = context.actions.enemies.segment(minimum, maximum);
  candidates.sort((left, right) => { const a = separation(left, from); const b = separation(right, from); return a - b; });
  attack.hitIds ??= [];
  const hitIds = new Set(attack.hitIds);
  const segment = { from, to };
  for (const enemy of candidates) {
    if (!living(enemy) || hitIds.has(enemy.id)) continue;
    const distance = context.actions.segmentDistance(enemy, segment);
    const fieldDistance = separation(enemy, attack);
    if (distance > enemy.radius + radius || fieldDistance > attack.radius + enemy.radius) continue;
    attack.hitIds.push(enemy.id); hitIds.add(enemy.id);
    const hit = { attack, enemy, flag, player };
    hitTarget(sim, hit, context);
    if (attack.flavor === 'banner-tempo') { attack.ttl = 0; break; }
  }
}
export function stepBannerCombat(sim: Simulation, dt: number, actions: BannerActions): void {
  if (sim.presentationOnly) return;
  const flags = sim.effects.filter(effect => effect.banner && effect.ttl > 0);
  const overlaps = new Map<string, Coverage[]>();
  const counters = new Set<string>();
  for (const player of sim.players) for (const buff of player.banners?.buffs ?? []) {
    if (!buff.counter) continue;
    buff.counter = false;
    if (player.hp > 0 && player.connected && buff.inside) counters.add(buff.fieldId);
  }
  for (const flag of flags) {
    const data = flag.banner;
    const owner = sim.players.find(player => player.id === flag.owner);
    const active = owner?.connected && owner.hp > 0 && owner.equipment.branches.some(branch => branch.item.id === flag.sourceId);
    if (!data || !active) { flag.ttl = 0; continue; }
    const age = (flag.duration ?? 0) - flag.ttl;
    if (age < data.warmup) continue;
    const key = `${flag.owner}:${flag.kind}`;
    const group = overlaps.get(key) ?? [];
    data.attackEpoch ??= group[0]?.flag.banner?.attackEpoch ?? sim.clock - age + data.warmup;
    const power = attackPower(sim, flag);
    group.push({ flag, power }); overlaps.set(key, group);
    if (counters.has(flag.id)) startAttack(sim, flag, true);
    const pattern = bannerAttackPattern(flag.kind);
    const cycle = Math.floor((sim.clock - data.attackEpoch + .000001) / pattern.interval);
    if (data.attackCycle === cycle) continue;
    const started = startAttack(sim, flag);
    if (started) data.attackCycle = cycle;
  }
  const hits = new Map<string, Set<string>>();
  const context = { dt, flags, overlaps, hits, actions };
  const attacks = sim.effects.filter(effect => effect.ttl > 0 && (effect.kind === 'banner-wave' || effect.kind === 'banner-bolt'));
  for (const attack of attacks) {
    if (attack.kind === 'banner-wave') stepWave(sim, attack, context);
    else stepBolt(sim, attack, context);
  }
}
