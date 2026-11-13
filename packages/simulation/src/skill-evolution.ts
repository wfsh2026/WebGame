import type { Effect, Enemy, Player, Projectile, Simulation, Vec } from './index';

export interface EvolutionShot { overload?: number; areaLevel?: number; areaScale?: number; releaseLevel?: number; releaseGroup?: string; terminal?: boolean; level?: number; fork?: number; spread?: number; echo?: number; delay?: number; returning?: boolean; returnable?: boolean; originX?: number; originY?: number; travel?: number; bounces?: number; secondary?: boolean }
export interface EvolutionEffect { edge?: boolean; innerRadius?: number; innerWidth?: number; shape?: string; targetId?: string; slow?: number; markPower?: number; markRemaining?: number; spreadCount?: number; groupId?: string; damage?: number; tick?: number; delay?: number; sourceId?: string; hitIds?: string[]; ring?: boolean }
interface Hit { enemy: Enemy; player?: Player; damage: number; source?: Vec; bypassShield?: boolean }
export interface EvolutionActions { hurt: (sim: Simulation, hit: Hit) => void }
function separation(a: Vec, b: Vec): number { const x = a.x - b.x; const y = a.y - b.y; return Math.hypot(x, y); }
function alive(enemy: Enemy): boolean { return enemy.hp > 0 && enemy.state !== 'detonating' && enemy.state !== 'escaped'; }
function visual(sim: Simulation, effect: Omit<Effect, 'ttl'>): void {
  if (sim.effects.some(entry => entry.id === effect.id)) return;
  sim.effects.push({ ...effect, ttl: effect.duration ?? .4 });
}
export function aftershock(sim: Simulation, data: { id: string; owner: string; sourceId: string; groupId?: string; x: number; y: number; radius: number; damage: number; level: number }): void {
  const active = sim.effects.filter(effect => effect.owner === data.owner && effect.kind === 'ability-aftershock' && effect.ttl > 0);
  if (active.length >= 16) active[0].ttl = 0;
  const radius = data.radius * (data.level >= 3 ? 1 : .75);
  const duration = data.level >= 20 ? 1.8 : data.level >= 10 ? 1.35 : 1;
  const effect: Effect = { ...data, level: data.level, id: `${data.id}-echo`, kind: 'ability-aftershock', radius, damage: data.damage * .45, delay: .45, tick: 0, ring: data.level >= 5, hitIds: [], duration, ttl: duration };
  if (!sim.effects.some(entry => entry.id === effect.id)) sim.effects.push(effect);
}
function slow(sim: Simulation, enemy: Enemy, data: { owner: string; amount: number; duration: number }): void {
  const factor = enemy.definition.rank === 'boss' ? data.amount / 2 : data.amount;
  const active = (enemy.slowUntil ?? 0) > sim.clock;
  enemy.slowFactor = active ? Math.max(enemy.slowFactor ?? 0, factor) : factor;
  enemy.slowUntil = Math.max(enemy.slowUntil ?? 0, sim.clock + data.duration);
  enemy.frostMarks ??= {}; enemy.frostMarks[data.owner] = sim.clock + data.duration;
}
function transfer(sim: Simulation, data: { enemy: Enemy; owner: string; count: number; range: number; frost?: { amount: number; duration: number } }): number {
  const mark = data.enemy.thunderMarks?.[data.owner];
  let count = 0;
  for (const target of sim.enemies) {
    if (!alive(target) || target.id === data.enemy.id) continue;
    if (data.frost ? (target.frostMarks?.[data.owner] ?? 0) > sim.clock : (target.thunderMarks?.[data.owner]?.remaining ?? 0) > 0) continue;
    const distance = separation(target, data.enemy); if (distance > data.range) continue;
    if (data.frost) { const status = { owner: data.owner, ...data.frost }; slow(sim, target, status); }
    else if (mark) { target.thunderMarks ??= {}; target.thunderMarks[data.owner] = { ...mark, transfer: false }; }
    else break;
    const effect = { id: `transfer-${data.enemy.id}-${target.id}-${data.owner}`, owner: data.owner, x: data.enemy.x, y: data.enemy.y, facingX: target.x, facingY: target.y, radius: .5, kind: data.frost ? 'ability-transfer-frost' : 'ability-transfer-thunder', duration: .35 };
    visual(sim, effect); count += 1; if (count >= data.count) break;
  }
  return count;
}
export function transferDeathMarks(sim: Simulation, enemy: Enemy): void {
  for (const [owner, mark] of Object.entries(enemy.thunderMarks ?? {})) {
    if (!mark.transfer || mark.remaining <= 0) continue;
    const data = { enemy, owner, count: 1, range: 3 }; transfer(sim, data); mark.transfer = false;
  }
}
export function evolveImpact(sim: Simulation, data: { shot: Projectile; enemy: Enemy; player: Player; wasSlowed: boolean; killed: boolean }, actions: EvolutionActions): void {
  const { shot, enemy, player } = data; const level = shot.level ?? 1;
  if (shot.effect === 'frost') {
    const radius = level >= 5 ? 1.25 * (shot.areaScale ?? 1) : 0;
    for (const target of sim.enemies) {
      if (!alive(target)) continue;
      const distance = separation(target, shot); if (target.id !== enemy.id && (!radius || distance > radius + target.radius)) continue;
      const castId = shot.castId ?? shot.id;
      const chilled = target.id === enemy.id ? data.wasSlowed : (target.frostMarks?.[player.id] ?? 0) > sim.clock && target.frostCasts?.[player.id] !== castId;
      if (level >= 10 && chilled) {
        const groupId = `${shot.castId ?? shot.id}-shatter`; const group = sim.castHits[groupId] ?? { ids: [], until: sim.clock + 8 }; sim.castHits[groupId] = group;
        if (!group.ids.includes(target.id)) {
          const strong = level >= 20 && sim.clock >= (target.strongFrostAt?.[player.id] ?? 0);
          group.ids.push(target.id); const hit = { enemy: target, player, damage: shot.damage * (strong ? .8 : .4), bypassShield: true }; actions.hurt(sim, hit);
          if (strong) { target.strongFrostAt ??= {}; target.strongFrostAt[player.id] = sim.clock + 3; }
          const effect = { id: `${shot.id}-shatter-${target.id}`, owner: player.id, x: target.x, y: target.y, radius: .65, kind: 'ability-shatter-frost', duration: .4 }; visual(sim, effect);
        }
      }
      target.frostCasts ??= {}; target.frostCasts[player.id] = castId;
      const status = { owner: player.id, amount: shot.slow ?? .25, duration: shot.slowDuration ?? 2 }; slow(sim, target, status);
    }
    if (level >= 15 && data.wasSlowed && !shot.secondary) {
      const field = { id: `${shot.id}-ice`, owner: player.id, sourceId: shot.sourceId, x: shot.x, y: shot.y, radius: 1.25 * (shot.areaScale ?? 1), kind: 'ability-ice-ground', duration: 2, ttl: 2, slow: shot.slow ?? .35, damage: 0, tick: 0 }; addGrowthField(sim, field);
    }
    if (radius && (shot.areaLevel ?? 0) >= 5 && !shot.secondary) {
      const area = shot.areaLevel ?? 0; const duration = area >= 20 ? .3 : .08;
      const edge: Effect = { id: `${shot.id}-edge`, owner: player.id, sourceId: shot.sourceId, groupId: shot.castId, x: shot.x, y: shot.y, radius: radius * (area >= 10 ? 1.3 : 1.2), innerRadius: radius, edge: true, kind: 'ability-area-edge', damage: shot.damage * (area >= 15 ? .65 : .4), duration, ttl: duration }; addGrowthField(sim, edge);
    }
    if (radius) { const effect = { id: `${shot.id}-frost-ring`, owner: player.id, x: shot.x, y: shot.y, radius, kind: 'ability-ring-frost', duration: .4 }; visual(sim, effect); }
  }
  if (shot.fork && !shot.secondary) {
    const base = Math.atan2(shot.vy, shot.vx); const speed = Math.hypot(shot.vx, shot.vy);
    const sides = shot.fork >= 20 ? [-1, 0, 1] : [-1, 1];
    const chosen = new Set<string>(shot.hitIds ?? []);
    for (const side of sides) {
      let angle = base + side * .55; let targetId: string | undefined;
      if (shot.fork >= 10) {
        const targets = sim.enemies.filter(target => alive(target) && !chosen.has(target.id));
        targets.sort((a, b) => { const da = separation(a, shot); const db = separation(b, shot); return da - db; });
        const target = targets.find(entry => { const distance = separation(entry, shot); return distance < speed * .4; });
        if (target) { angle = Math.atan2(target.y - shot.y, target.x - shot.x); targetId = target.id; chosen.add(target.id); }
      }
      const vx = Math.cos(angle) * speed; const vy = Math.sin(angle) * speed;
      const child: Projectile = { ...shot, id: `${shot.id}-fork-${side}`, vx, vy, ttl: shot.fork >= 3 ? .4 : .25, damage: shot.damage * .5, pierces: shot.fork >= 15 ? 3 : shot.fork >= 5 ? 2 : 1, secondary: true, targetId, resonance: 0, overload: 0, echo: 0, areaLevel: 0, returnable: false, fork: 0, spread: 0, bounces: 0, bounce: false, hitIds: [enemy.id], delay: 0 };
      sim.projectiles.push(child);
    }
    shot.fork = 0;
  }
  if (data.killed && shot.spread && !shot.secondary) {
    const frost = shot.effect === 'frost' ? { amount: shot.slow ?? .25, duration: shot.slowDuration ?? 2 } : undefined;
    const mark = enemy.thunderMarks?.[player.id];
    if (shot.spread >= 20 && mark) mark.remaining = Math.max(2, mark.remaining);
    const propagation = { enemy, owner: player.id, count: shot.spread >= 15 ? 4 : shot.spread >= 5 ? 3 : 2, range: shot.spread >= 3 ? 4 : 3, frost }; const count = transfer(sim, propagation);
    if (shot.spread >= 10 && count === 0) {
      const pending: Effect = { id: `${shot.id}-spread`, owner: player.id, sourceId: shot.sourceId, x: enemy.x, y: enemy.y, radius: 4, kind: 'ability-spread-wait', duration: 1.5, ttl: 1.5, markPower: mark?.power, markRemaining: mark?.remaining, slow: frost?.amount, spreadCount: propagation.count, level: shot.spread }; addGrowthField(sim, pending);
    }
  }
  if (shot.blast && level >= 15 && !shot.secondary) {
    const key = `${shot.castId ?? shot.id}-pulse`;
    const old = sim.effects.find(effect => effect.kind === 'ability-burning' && effect.owner === player.id && effect.ttl > 0 && separation(effect, shot) <= effect.radius);
    if (old && !sim.castHits[key]) {
      sim.castHits[key] = { ids: [], until: sim.clock + 8 };
      const pulse: Effect = { id: key, owner: player.id, sourceId: shot.sourceId, x: old.x, y: old.y, radius: old.radius, kind: 'ability-fire-pulse', damage: shot.damage * .35, duration: .3, ttl: .3 }; addGrowthField(sim, pulse);
      if (level >= 20) old.ttl = old.duration ?? 3;
    }
  }
  if (shot.blast && level >= 5) {
    const duration = level >= 10 ? 3 : 1.5;
    const fields = sim.effects.filter(effect => effect.owner === player.id && effect.kind === 'ability-burning' && effect.ttl > 0);
    if (fields.length >= 8) fields[0].ttl = 0;
    const effect: Effect = { id: `${shot.id}-burn`, owner: player.id, sourceId: shot.sourceId, x: shot.x, y: shot.y, radius: shot.blast, kind: 'ability-burning', damage: shot.damage * .15, tick: 0, duration, ttl: duration };
    sim.effects.push(effect);
  }
  if ((shot.areaLevel ?? 0) >= 5 && shot.blast && !shot.secondary) {
    const edge: Effect = { id: `${shot.id}-edge`, owner: player.id, sourceId: shot.sourceId, groupId: shot.castId, x: shot.x, y: shot.y, radius: shot.blast * ((shot.areaLevel ?? 0) >= 10 ? 1.3 : 1.2), innerRadius: shot.blast, edge: true, kind: 'ability-area-edge', damage: shot.damage * ((shot.areaLevel ?? 0) >= 15 ? .65 : .4), duration: (shot.areaLevel ?? 0) >= 20 ? .3 : .08, ttl: (shot.areaLevel ?? 0) >= 20 ? .3 : .08 }; addGrowthField(sim, edge);
  }
  if (shot.blast && shot.echo && !shot.secondary) {
    const echo = { id: shot.id, owner: player.id, sourceId: shot.sourceId ?? '', groupId: shot.castId ?? shot.id, x: shot.x, y: shot.y, radius: shot.blast, damage: shot.damage, level: shot.echo }; aftershock(sim, echo);
  }
}
export function returnProjectile(shot: Projectile): void {
  if (!shot.returnable || shot.returning || shot.ttl > 0) return;
  const dx = (shot.originX ?? shot.x) - shot.x; const dy = (shot.originY ?? shot.y) - shot.y; const distance = Math.hypot(dx, dy);
  if (distance < .1) return;
  const speed = Math.hypot(shot.vx, shot.vy);
  shot.id += '-return'; shot.castId = `${shot.castId}-return`; shot.returning = true; shot.returnable = false;
  shot.vx = dx / distance * speed; shot.vy = dy / distance * speed; shot.ttl = (shot.level ?? 1) >= 20 ? 2 : distance / speed; shot.damage *= .5; shot.resonance = 0; shot.hitIds = []; shot.pierces = (shot.level ?? 1) >= 15 ? 6 : 4; shot.fork = 0; shot.spread = 0; shot.overload = 0;
}
export function addGrowthField(sim: Simulation, effect: Effect): void {
  if (sim.effects.some(entry => entry.id === effect.id)) return;
  const active = sim.effects.filter(entry => entry.owner === effect.owner && entry.sourceId && entry.ttl > 0);
  if (active.length >= 40) active[0].ttl = 0;
  sim.effects.push(effect);
}
export function stepEvolution(sim: Simulation, dt: number, actions: EvolutionActions): void {
  const fields = sim.effects.filter(effect => !effect.kind.startsWith('banner-') && effect.kind !== 'ability-melee-windup' && !effect.kind.startsWith('ability-novel-') && effect.sourceId && (effect.damage !== undefined || effect.slow || effect.kind === 'ability-spread-wait'));
  for (const effect of fields) {
    if (effect.ttl <= 0) continue;
    const player = sim.players.find(entry => entry.id === effect.owner);
    const active = player?.equipment.branches.some(branch => branch.item.id === effect.sourceId);
    if (!player || player.hp <= 0 || !active) { effect.ttl = 0; continue; }
    if ((effect.delay ?? 0) > 0) { effect.delay = Math.max(0, (effect.delay ?? 0) - dt); if (effect.delay > 0) continue; }
    effect.tick = (effect.tick ?? 0) - dt; if (effect.tick > 0) continue;
    const fire = effect.kind === 'ability-burning'; const ground = effect.kind === 'ability-ice-ground' || effect.kind === 'ability-cracked-ground'; const echo = effect.kind === 'ability-aftershock';
    effect.tick = fire || ground ? .5 : 0;
    if (effect.targetId && (effect.kind === 'ability-star-terminal' || effect.kind === 'ability-dual-finish')) {
      const target = sim.enemies.find(enemy => enemy.id === effect.targetId && alive(enemy));
      if (!target) { effect.ttl = 0; continue; } effect.x = target.x; effect.y = target.y;
    }
    const elapsed = (effect.duration ?? 1) - effect.ttl; const extension = (effect.level ?? 0) >= 10 ? .75 : .45;
    const bounded = Math.max(0, (elapsed - .45) / extension); const progress = Math.min(1, bounded);
    const inward = echo && (effect.level ?? 0) >= 20 && elapsed > 1.2;
    const radius = echo && effect.ring ? effect.radius * (inward ? Math.max(0, (effect.ttl / .6)) : progress) : effect.radius;
    const targets = sim.enemies.filter(alive);
    for (const enemy of targets) {
      if (effect.targetId && enemy.id !== effect.targetId) continue;
      const dx = enemy.x - effect.x; const dy = enemy.y - effect.y; const distance = Math.hypot(dx, dy);
      let inside = distance <= radius + enemy.radius;
      if (inward) inside &&= distance >= radius - enemy.radius - .3;
      if (effect.shape === 'spear') {
        const forward = dx * (effect.facingX ?? 1) + dy * (effect.facingY ?? 0); const lateral = Math.abs(dx * (effect.facingY ?? 0) - dy * (effect.facingX ?? 1));
        inside = forward >= 0 && forward <= radius + enemy.radius && lateral <= (effect.width ?? 1) / 2 + enemy.radius;
        if (effect.edge && forward <= (effect.innerRadius ?? 0) + enemy.radius && lateral <= (effect.innerWidth ?? 0) / 2 + enemy.radius) inside = false;
      } else {
        if (effect.edge && distance <= (effect.innerRadius ?? 0) + enemy.radius) inside = false;
        if (effect.angle && effect.angle < 360) { const forward = dx * (effect.facingX ?? 1) + dy * (effect.facingY ?? 0); const threshold = Math.cos(effect.angle * Math.PI / 360); inside &&= forward >= distance * threshold; }
      }
      if (!inside) continue;
      if (effect.kind === 'ability-spread-wait') {
        if (effect.slow) { if ((enemy.frostMarks?.[player.id] ?? 0) > sim.clock) continue; const data = { owner: player.id, amount: effect.slow, duration: 2 }; slow(sim, enemy, data); }
        else { if ((enemy.thunderMarks?.[player.id]?.remaining ?? 0) > 0) continue; enemy.thunderMarks ??= {}; const remaining = Math.max((effect.level ?? 0) >= 20 ? 2 : .1, (effect.markRemaining ?? 2) - elapsed); enemy.thunderMarks[player.id] = { power: effect.markPower ?? 0, remaining, transfer: false }; }
        const link = { id: `${effect.id}-${enemy.id}`, owner: player.id, x: effect.x, y: effect.y, facingX: enemy.x, facingY: enemy.y, radius: .5, kind: effect.slow ? 'ability-transfer-frost' : 'ability-transfer-thunder', duration: .35 }; visual(sim, link);
        effect.spreadCount = (effect.spreadCount ?? 1) - 1; if (effect.spreadCount <= 0) { effect.ttl = 0; break; } continue;
      }
      if (ground) {
        const factor = enemy.definition.rank === 'boss' ? (effect.slow ?? .2) / 2 : effect.slow ?? .2;
        enemy.slowFactor = Math.max(enemy.slowFactor ?? 0, factor); enemy.slowUntil = Math.max(enemy.slowUntil ?? 0, sim.clock + .6); continue;
      }
      if (fire) {
        if ((enemy.burnUntil?.[player.id] ?? 0) > sim.clock) continue;
        const strongest = fields.filter(entry => entry.kind === 'ability-burning' && entry.owner === player.id && entry.ttl > 0 && separation(entry, enemy) <= entry.radius + enemy.radius).reduce((best, entry) => Math.max(best, entry.damage ?? 0), 0);
        enemy.burnUntil ??= {}; enemy.burnUntil[player.id] = sim.clock + .49;
        const hit = { enemy, player, damage: strongest, source: effect, bypassShield: true, flavor: 'ability-burning' }; actions.hurt(sim, hit); continue;
      }
      const groupId = `${effect.groupId ?? effect.id}-${effect.edge ? 'edge' : inward ? 'inward' : 'field'}`;
      const group = sim.castHits[groupId] ?? { ids: [], until: sim.clock + 8 }; sim.castHits[groupId] = group;
      const primary = effect.edge && effect.groupId ? sim.castHits[effect.groupId] : undefined;
      if (group.ids.includes(enemy.id) || primary?.ids.includes(enemy.id)) continue;
      group.ids.push(enemy.id); if (primary) primary.ids.push(enemy.id);
      const edgeBoost = echo && (effect.level ?? 0) >= 15 && distance >= effect.radius * .75 ? 1.25 : 1;
      const hit = { enemy, player, damage: (effect.damage ?? 0) * edgeBoost * (inward ? .5 : 1), source: effect, bypassShield: true, flavor: effect.kind }; actions.hurt(sim, hit);
    }
  }
}
