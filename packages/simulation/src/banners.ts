import type { AbilityState, Effect, Player, Projectile, Simulation, Vec } from './index';
import { isBanner, itemAtLevel, supportProgress } from './equipment';

export const bannerKinds = ['banner-power', 'banner-tempo', 'banner-wind', 'banner-energy', 'banner-guard'];
export const bannerNames = ['破军战旗', '催锋战旗', '疾羽战旗', '归元战旗', '镇岳战旗'];
type Branch = Player['equipment']['branches'][number];
export interface BannerField { attackEpoch?: number; attackCycle?: number; attacks?: number; strength: number; linger: number; lingerFactor: number; tail: number; warmup: number; levels: Record<string, number> }
export interface BannerBuff { counter?: boolean; kind: string; sourceId: string; owner: string; fieldId: string; strength: number; level: number; remaining: number; linger: number; lingerFactor: number; inside: boolean; held: number; charge: number; entryWait: number; pulseWait: number; shieldWait: number; shield: number; resist: number; x: number; y: number; lastCast: string; castPower: number }
export interface BannerState { buffs: BannerBuff[]; selfBudget: number }
export interface MeleeCast { count: number; range: number; empowered: number; overloaded: boolean; target: string }
function distance(a: Vec, b: Vec): number { const x = a.x - b.x; const y = a.y - b.y; return Math.hypot(x, y); }
interface BannerAttackPattern { name: string; interval: number; coefficient: number; duration: number; speed: number; width: number }
const attackPatterns: Record<string, BannerAttackPattern> = {
  'banner-power': { name: '军威冲击', interval: 1.5, coefficient: .45, duration: .4, speed: 0, width: .45 },
  'banner-tempo': { name: '催锋点刺', interval: .75, coefficient: .2, duration: 0, speed: 28, width: .2 },
  'banner-wind': { name: '穿阵风刃', interval: 1, coefficient: .25, duration: 0, speed: 12, width: .6 },
  'banner-energy': { name: '归元灵潮', interval: 2, coefficient: .2, duration: .6, speed: 0, width: .4 },
  'banner-guard': { name: '地脉震击', interval: 2, coefficient: .3, duration: .45, speed: 0, width: .5 }
};
export function bannerAttackPattern(kind: string): BannerAttackPattern { return attackPatterns[kind] ?? attackPatterns['banner-power']; }
export function bannerAttackDamage(branch: Branch, magicalAttack: number): number {
  let item = branch.item;
  // Older checkpoints can still carry the original zero-damage equipment definition.
  if (!item.coefficient) {
    const pattern = bannerAttackPattern(item.effect ?? '');
    const definition = { ...item, coefficient: pattern.coefficient, damage: 0 };
    item = itemAtLevel(definition, item.level ?? 1);
  }
  return ((item.damage ?? 0) + magicalAttack * (item.coefficient ?? 0)) * branch.damageMultiplier;
}
export function bannerConfig(branch: Branch) {
  const level = branch.item.level ?? 1; const levels = branch.supportLevels; const kind = branch.item.effect;
  const durationLevel = levels.duration ?? 0; const durationProgress = durationLevel ? supportProgress(durationLevel) : 0;
  const lingerLevel = levels.linger ?? 0; const lingerProgress = lingerLevel ? supportProgress(lingerLevel) : 0;
  const radiusGrowth = level >= 5 && ['banner-power', 'banner-wind', 'banner-guard'].includes(kind ?? '') ? 1.2 : 1;
  const durationGrowth = level >= 5 && ['banner-tempo', 'banner-energy'].includes(kind ?? '') ? 3 : 0;
  const radius = 4 * radiusGrowth * branch.areaMultiplier;
  const duration = (8 + durationGrowth) * (durationLevel ? 1.3 + durationProgress * .3 : 1);
  const linger = (kind === 'banner-tempo' && level >= 15 ? 2 : 1) + (lingerLevel ? 1.5 + lingerProgress * 1.5 : 0);
  const strength = branch.damageMultiplier * (1 + (level - 1) * .015);
  const fadeTail = durationLevel >= 10 ? durationLevel >= 20 ? 2 : 1 : 0; const windTail = kind === 'banner-wind' && level >= 20 ? 2 : 0; const tail = Math.max(fadeTail, windTail);
  const warmup = .35 / (1 + (levels.haste ?? 0) * .035);
  return { radius, duration, linger, strength, tail, warmup, maximum: levels.twin ? 2 : 1, lingerFactor: lingerLevel ? .65 + lingerProgress * .12 : 1 };
}
export function bannerCast(sim: Simulation, player: Player, data: { branch: Branch; state: AbilityState }): void {
  const { branch, state } = data; const config = bannerConfig(branch); const item = branch.item;
  const flags = sim.effects.filter(effect => effect.kind === item.effect && effect.owner === player.id && effect.sourceId === item.id && effect.ttl > 0);
  const covering = flags.some(effect => distance(player, effect) <= effect.radius && effect.ttl > config.tail);
  const fighting = sim.enemies.some(enemy => enemy.hp > 0 && enemy.state !== 'escaped' && enemy.state !== 'detonating' && distance(enemy, player) <= 10);
  const levels = branch.supportLevels;
  const loyalty = flags.some(effect => (effect.duration ?? 0) - effect.ttl >= 4);
  const saving = (levels.economy ?? 0) >= 10 && loyalty ? (levels.economy ?? 0) >= 20 ? .85 : .92 : 1;
  const focus = player.focusLeft > 0 ? .8 : 1;
  const cost = item.cost * branch.costMultiplier * saving * focus;
  state.state = player.blocking ? '格挡中' : covering ? '旗阵维持中' : !fighting ? '等待交战' : state.remaining > 0 ? '等待布旗' : player.energy < cost ? '等待供能' : '就绪';
  if (state.state !== '就绪' || !player.equipment.heart) return;
  if (flags.length >= config.maximum) {
    flags.sort((a, b) => { const occupiedA = sim.players.some(ally => ally.hp > 0 && ally.connected && distance(ally, a) <= a.radius); const occupiedB = sim.players.some(ally => ally.hp > 0 && ally.connected && distance(ally, b) <= b.radius); return Number(occupiedA) - Number(occupiedB) || a.ttl - b.ttl; });
    flags[0].ttl = 0;
  }
  player.energy -= cost; state.count += 1; player.rangedCount += 1;
  const twinSpeed = (levels.twin ?? 0) >= 10 && flags.length ? (levels.twin ?? 0) >= 20 ? .75 : .85 : 1;
  const rawInterval = item.interval * branch.intervalMultiplier / player.stats.castingSpeed * twinSpeed;
  state.remaining = Math.max(.75, rawInterval); state.state = '已布旗';
  const kind = item.effect ?? ''; const id = `${player.id}-${item.id}-${state.count}`;
  const damage = bannerAttackDamage(branch, player.stats.magicalAttack);
  const existing = sim.effects.find(effect => effect.owner === player.id && effect.kind === kind && effect.ttl > 0 && effect.banner?.attackEpoch !== undefined);
  const attackEpoch = existing?.banner?.attackEpoch ?? sim.clock + config.warmup;
  const banner: BannerField = { attackEpoch, attackCycle: -1, attacks: 0, strength: config.strength, linger: config.linger, lingerFactor: config.lingerFactor, tail: config.tail, warmup: config.warmup, levels: { ...levels } };
  const effect: Effect = { id, owner: player.id, sourceId: item.id, level: item.level ?? 1, x: player.x, y: player.y, kind, radius: config.radius, damage, duration: config.duration + config.tail + config.warmup, ttl: config.duration + config.tail + config.warmup, banner };
  if (!sim.effects.some(entry => entry.id === id)) sim.effects.push(effect);
  if (kind === 'banner-energy') { const status = player.banners ??= { buffs: [], selfBudget: 0 }; const total = status.selfBudget + cost * .8; status.selfBudget = Math.min(cost * .8 * config.maximum, total); }
}
function createBuff(kind: string, player: Player): BannerBuff {
  return { kind, sourceId: '', owner: '', fieldId: '', strength: 0, level: 1, remaining: 0, linger: 1, lingerFactor: 1, inside: false, held: 0, charge: 0, entryWait: 0, pulseWait: 0, shieldWait: 0, shield: 0, resist: 0, x: player.x, y: player.y, lastCast: '', castPower: 0 };
}
export function stepBanners(sim: Simulation, dt: number, localPlayerId?: string): void {
  const flags = sim.effects.filter(effect => isBanner(effect.kind) && effect.ttl > 0 && effect.banner);
  for (const flag of flags) {
    const owner = sim.players.find(player => player.id === flag.owner);
    if (!owner?.connected || owner.hp <= 0 || !owner.equipment.branches.some(branch => branch.item.id === flag.sourceId)) flag.ttl = 0;
  }
  for (const player of sim.players) {
    if (sim.presentationOnly && localPlayerId && player.id !== localPlayerId) continue;
    const status = player.banners ??= { buffs: [], selfBudget: 0 };
    if (!player.equipment.branches.some(branch => branch.item.effect === 'banner-energy')) status.selfBudget = 0;
    if (player.hp <= 0 || !player.connected) { status.buffs = []; continue; }
    for (const kind of bannerKinds) {
      let buff = status.buffs.find(entry => entry.kind === kind);
      if (!buff) { buff = createBuff(kind, player); status.buffs.push(buff); }
      const wasInside = buff.inside;
      buff.remaining = Math.max(0, buff.remaining - dt); buff.entryWait = Math.max(0, buff.entryWait - dt); buff.pulseWait = Math.max(0, buff.pulseWait - dt); buff.shieldWait = Math.max(0, buff.shieldWait - dt); buff.resist = Math.max(0, buff.resist - dt);
      let chosen: Effect | undefined; let strongest = 0;
      for (const flag of flags) {
        const data = flag.banner; if (flag.kind !== kind || flag.ttl <= 0 || !data) continue;
        if (kind === 'banner-energy' && flag.owner === player.id && status.selfBudget <= 0) continue;
        const age = (flag.duration ?? 0) - flag.ttl; if (age < data.warmup) continue;
        const separation = distance(player, flag);
        const edge = (data.levels.area ?? 0) >= 10 ? 1.15 : 1;
        if (separation > flag.radius * edge) continue;
        let strength = data.strength * (separation > flag.radius ? .5 : 1);
        if (flag.ttl < data.tail) strength *= flag.ttl / data.tail;
        if ((data.levels.overload ?? 0) >= 5 && age < 2) strength *= 1.15;
        if ((data.levels.concentrate ?? 0) >= 10 && buff.held >= 3) strength *= (data.levels.concentrate ?? 0) >= 20 ? 1.2 : 1.1;
        const level = flag.level ?? 1;
        if (kind === 'banner-power' && level >= 15) { const ramp = Math.min(.2, buff.held * .04); strength *= 1 + ramp; }
        if (kind === 'banner-tempo' && level >= 10) { const ramp = Math.min(.25, buff.held * .05); strength *= 1 + ramp; }
        if (kind === 'banner-energy' && level >= 15 && player.energy < player.capacity * .25) strength *= 1.25;
        if (strength > strongest) { strongest = strength; chosen = flag; }
      }
      if (chosen && buff.remaining > 0 && chosen.id !== buff.fieldId && strongest < buff.strength * buff.lingerFactor) {
        const oldField = flags.find(flag => flag.id === buff?.fieldId && flag.ttl > 0);
        if (!oldField || distance(player, oldField) > oldField.radius) chosen = undefined;
      }
      buff.inside = Boolean(chosen);
      if (chosen?.banner) {
        const data = chosen.banner;
        const moved = distance(player, buff);
        buff.held = wasInside && (kind !== 'banner-guard' || moved < .03) ? buff.held + dt : 0;
        buff.strength = strongest; buff.level = chosen.level ?? 1; buff.sourceId = chosen.sourceId ?? ''; buff.fieldId = chosen.id; buff.owner = chosen.owner ?? '';
        buff.linger = data.linger; buff.lingerFactor = data.lingerFactor; buff.remaining = data.linger;
        if (!wasInside && buff.level >= 10 && buff.entryWait <= 0 && (kind === 'banner-power' || kind === 'banner-energy')) { buff.charge = .2; buff.entryWait = 8; }
        if (buff.level >= 20 && buff.pulseWait <= 0) { buff.pulseWait = 6; buff.resist = 1.5; if (kind === 'banner-power' || kind === 'banner-energy') buff.charge = .3; }
        if (kind === 'banner-tempo' && buff.resist > 0 && buff.level >= 20) buff.strength *= 1.3;
        const shifted = distance(player, buff);
        if (kind === 'banner-guard' && buff.level >= 10 && buff.held >= 2 && shifted < .03 && buff.shieldWait <= 0) {
          buff.shield = player.maxHp * .05; buff.shieldWait = 6;
        }
      } else {
        buff.held = 0;
        const owner = sim.players.find(entry => entry.id === buff?.owner);
        if (!owner?.connected || owner.hp <= 0 || !owner.equipment.branches.some(branch => branch.item.id === buff?.sourceId)) buff.remaining = 0;
      }
      buff.x = player.x; buff.y = player.y;
      if (buff.remaining <= 0) { buff.strength = 0; buff.shield = 0; buff.charge = 0; buff.castPower = 0; buff.counter = false; }
    }
  }
}
export function bannerBuff(player: Player, kind: string): BannerBuff | undefined { return player.banners?.buffs.find(buff => buff.kind === kind && buff.remaining > 0 && player.hp > 0); }
export function bannerStrength(player: Player, kind: string): number {
  const buff = bannerBuff(player, kind); if (!buff) return 0;
  const fade = !buff.inside ? buff.lingerFactor * (buff.remaining < .5 ? buff.remaining / .5 : 1) : 1;
  return buff.strength * fade;
}
export function bannerDamage(player: Player, hit: { flavor?: string; castId?: string }): number {
  if (hit.flavor?.startsWith('banner-')) return 1;
  if (['ability-burning', 'ability-novel-curse', 'ability-cracked-ground'].includes(hit.flavor ?? '')) return 1;
  const buff = bannerBuff(player, 'banner-power'); if (!buff) return 1;
  const power = bannerStrength(player, 'banner-power'); let extra = 0;
  if (hit.castId) {
    if (buff.lastCast !== hit.castId) { buff.lastCast = hit.castId; buff.castPower = buff.charge; buff.charge = 0; }
    extra = buff.castPower;
  }
  const bonus = .12 * power + extra; return 1 + Math.min(.6, bonus);
}
export function bannerTempo(player: Player): number { const power = bannerStrength(player, 'banner-tempo'); const reduction = Math.min(.35, power * .1); return 1 - reduction; }
export function bannerWind(player: Player): number { const power = bannerStrength(player, 'banner-wind'); const bonus = Math.min(.6, power * .2); return 1 + bonus; }
export function bannerRecovery(player: Player, base: number): number {
  const buff = bannerBuff(player, 'banner-energy'); if (!buff) return 0;
  const strength = bannerStrength(player, 'banner-energy'); const rate = Math.min(.6, .15 * strength + buff.charge);
  const extra = base * rate;
  return buff.owner === player.id ? Math.min(extra, player.banners?.selfBudget ?? 0) : extra;
}
export function spendBannerRecovery(player: Player, extra: number): void {
  const buff = bannerBuff(player, 'banner-energy'); if (!buff || extra <= 0) return;
  buff.charge = 0;
  if (buff.owner === player.id && player.banners) player.banners.selfBudget = Math.max(0, player.banners.selfBudget - extra);
}
export function bannerGuard(player: Player, damage: number): { damage: number; absorbed: number } {
  const buff = bannerBuff(player, 'banner-guard'); const strength = bannerStrength(player, 'banner-guard');
  const phase = buff && buff.level >= 15 && buff.resist > 0 ? buff.level >= 20 ? 1.5 : 1.25 : 1; const reduction = Math.min(.35, strength * .08 * phase);
  const reduced = damage * (1 - reduction); const absorbed = Math.min(buff?.shield ?? 0, reduced);
  if (buff) {
    buff.shield -= absorbed;
    if (absorbed > 0 && buff.shield <= 0 && buff.level >= 15) { buff.resist = 1.5; buff.counter = true; }
  }
  return { damage: reduced - absorbed, absorbed };
}
export function bannerFlight(sim: Simulation, shot: Projectile): void {
  if (shot.hostile) return;
  const player = sim.players.find(entry => entry.id === shot.owner); if (!player) return;
  let multiplier = bannerWind(player);
  for (const field of sim.effects) {
    const data = field.banner; const age = (field.duration ?? 0) - field.ttl;
    if (field.kind !== 'banner-wind' || field.ttl <= 0 || !data || age < data.warmup || (field.level ?? 1) < 10 || distance(shot, field) > field.radius) continue;
    const fade = data.tail > 0 ? Math.min(1, field.ttl / data.tail) : 1;
    const candidate = 1 + Math.min(.6, data.strength * .2 * fade); multiplier = Math.max(multiplier, candidate);
  }
  const previous = shot.windScale ?? 1; const ratio = multiplier / previous;
  shot.vx *= ratio; shot.vy *= ratio; shot.ttl /= ratio; shot.windScale = multiplier;
}
