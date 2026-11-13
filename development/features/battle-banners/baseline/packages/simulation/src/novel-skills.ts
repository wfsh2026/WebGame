import { abilityProgress } from './combat-rhythm';
import type { Effect, Enemy, Player, Simulation, Vec, AbilityState, Projectile } from './index';
import { recordAbilityHit } from './resonance';
import { aftershock } from './skill-evolution';

type Branch = Player['equipment']['branches'][number];
interface Actions { hurt: (sim: Simulation, hit: { enemy: Enemy; player?: Player; damage: number; source?: Vec; bypassShield?: boolean; flavor?: string; castId?: string }) => void }
interface Cast { player: Player; branch: Branch; target: Enemy; damage: number; id: string; state: AbilityState; cost: number }
export interface NovelFields { generation?: number; pulses?: number; paidCost?: number; resonancePower?: number; primaryTarget?: string }
export const novelKinds = ['star-beam', 'chain-lightning', 'decay-curse', 'sword-array', 'binding-trap'];
function distance(a: Vec, b: Vec): number { const x = a.x - b.x; const y = a.y - b.y; return Math.hypot(x, y); }
function living(enemy: Enemy): boolean { return enemy.hp > 0 && enemy.state !== 'detonating' && enemy.state !== 'escaped'; }
function add(sim: Simulation, effect: Effect): void { if (!sim.effects.some(entry => entry.id === effect.id)) sim.effects.push(effect); }
function hit(sim: Simulation, data: { enemy: Enemy; player: Player; effect: Effect; damage: number }, actions: Actions): void {
  const { enemy, player, effect, damage } = data;
  const groupId = `novel-hit-${effect.groupId ?? effect.id}`;
  if (!sim.castHits[groupId]) {
    sim.castHits[groupId] = { ids: [], until: sim.clock + 12 };
    const state = player.abilityStates.find(entry => entry.itemId === effect.sourceId);
    if (state) { const progress = abilityProgress(state); progress.overload = 0; progress.overloadCast = 0; }
    const notice = { kind: 'skill', sourceId: effect.sourceId ?? '', resonance: effect.resonancePower ?? 0 }; recordAbilityHit(player, notice);
  }
  const event = { enemy, player, damage, source: effect, bypassShield: true, flavor: effect.kind, castId: effect.groupId ?? effect.id }; actions.hurt(sim, event);
}
function curse(sim: Simulation, data: { effect: Effect; target: Enemy; generation: number }): void {
  const existing = sim.effects.find(entry => entry.kind === 'ability-novel-curse' && entry.owner === data.effect.owner && entry.targetId === data.target.id && entry.ttl > 0);
  if (existing) { existing.ttl = 4; existing.damage = Math.max(existing.damage ?? 0, data.effect.damage ?? 0); return; }
  const count = sim.effects.filter(entry => entry.kind === 'ability-novel-curse' && entry.owner === data.effect.owner && entry.ttl > 0).length; if (count >= 32) return;
  const effect: Effect = { ...data.effect, id: `${data.effect.id}-${data.target.id}`, targetId: data.target.id, x: data.target.x, y: data.target.y, generation: data.generation, duration: 4, ttl: 4, tick: .65, kind: 'ability-novel-curse' }; add(sim, effect);
}
export function castNovel(sim: Simulation, data: Cast, actions: Actions): boolean {
  const { player, branch, target, damage, id } = data; const item = branch.item; const level = item.level ?? 1;
  if (!novelKinds.includes(item.effect ?? '')) return false;
  const base: Effect = { id: `novel-${id}`, groupId: id, owner: player.id, sourceId: item.id, level, x: player.x, y: player.y, damage, paidCost: data.cost, resonancePower: branch.resonance, radius: (item.range ?? 8) * branch.areaMultiplier, kind: '', duration: .4, ttl: .4 };
  if (item.effect === 'star-beam') {
    const rawLength = distance(player, target); const length = Math.max(.01, rawLength); const effect: Effect = { ...base, kind: 'ability-novel-beam', paidCost: item.cost * branch.costMultiplier, radius: level >= 5 ? 10 : 8, width: .35 * branch.areaMultiplier, facingX: (target.x - player.x) / length, facingY: (target.y - player.y) / length, targetId: target.id, duration: 1.2, ttl: 1.2, tick: 0, pulses: 0 }; add(sim, effect);
  } else if (item.effect === 'chain-lightning') {
    let current = target; let origin: Vec = player; const used = new Set<string>(); const count = level >= 5 ? 5 : 3; const reach = level >= 10 ? 4 : 3;
    for (let index = 0; index < count; index += 1) {
      used.add(current.id); const effect: Effect = { ...base, id: `${base.id}-${index}`, kind: 'ability-novel-chain', x: origin.x, y: origin.y, facingX: current.x, facingY: current.y, duration: .3, ttl: .3 };
      add(sim, effect); const event = { enemy: current, player, effect, damage: damage * Math.pow(.85, index) }; hit(sim, event, actions);
      origin = current;
      const targets = sim.enemies.filter(enemy => living(enemy) && !used.has(enemy.id) && distance(enemy, current) <= reach);
      targets.sort((a, b) => { const am = level >= 15 && a.thunderMarks?.[player.id] ? -10 : 0; const bm = level >= 15 && b.thunderMarks?.[player.id] ? -10 : 0; return am - bm + distance(a, current) - distance(b, current); });
      if (!targets.length || index === count - 1) {
        if (level >= 20 && living(current)) { const rebound = { enemy: current, player, effect, damage: damage * .35 }; hit(sim, rebound, actions); }
        break;
      }
      current = targets[0];
    }
  } else if (item.effect === 'decay-curse') {
    base.radius = branch.spread >= 3 ? 4 : 3; base.spreadCount = branch.spread >= 5 ? 3 : 2;
    const application = { effect: base, target, generation: 0 }; curse(sim, application);
  } else if (item.effect === 'sword-array') {
    let array = sim.effects.find(effect => effect.kind === 'ability-novel-array' && effect.owner === player.id && effect.sourceId === item.id && effect.ttl > 0);
    if (!array) { array = { ...base, kind: 'ability-novel-array', x: player.x + (target.x - player.x) * .5, y: player.y + (target.y - player.y) * .5, radius: 5, duration: level >= 5 ? 8 : 5, ttl: level >= 5 ? 8 : 5 }; add(sim, array); }
    const candidates = sim.enemies.filter(enemy => living(enemy) && distance(enemy, array!) <= 5);
    candidates.sort((a, b) => { const outsideA = level >= 15 && distance(a, player) > 5 ? -10 : 0; const outsideB = level >= 15 && distance(b, player) > 5 ? -10 : 0; return outsideA - outsideB + distance(a, array!) - distance(b, array!); });
    const targets = candidates.slice(0, level >= 10 ? 2 : 1);
    const closing = level >= 20 && array.ttl < item.interval * 1.5;
    for (const [targetIndex, victim] of targets.entries()) {
      const angle = Math.atan2(victim.y - array.y, victim.x - array.x); const count = branch.projectiles + (closing ? 2 : 0);
      for (let index = 0; index < count; index += 1) {
        const heading = angle + (index - (count - 1) / 2) * .2; const vx = Math.cos(heading) * 13; const vy = Math.sin(heading) * 13;
        const shot: Projectile = { id: `${id}-${targetIndex}-${index}`, castId: id, sourceId: item.id, owner: player.id, effect: 'spirit-sword', x: array.x, y: array.y, vx, vy, ttl: .6, damage: damage * (targets.length > 1 ? .7 : 1) * (closing ? .7 : 1), level, fork: branch.fork, pierces: 1, hitIds: [], resonance: branch.resonance }; sim.projectiles.push(shot);
      }
    }
  } else {
    const fields = sim.effects.filter(effect => effect.kind === 'ability-novel-trap' && effect.owner === player.id && effect.sourceId === item.id && effect.ttl > 0);
    const maximum = level >= 15 ? 2 : 1; if (fields.length >= maximum) fields[0].ttl = 0;
    const effect: Effect = { ...base, kind: 'ability-novel-trap', x: target.x, y: target.y, radius: (level >= 5 ? 2 : 1.5) * branch.areaMultiplier, duration: 8, ttl: 8, delay: .6, pulses: 0, spreadCount: branch.echo }; add(sim, effect);
  }
  return true;
}
export function stepNovel(sim: Simulation, dt: number, actions: Actions): void {
  const effects = sim.effects.filter(effect => ['ability-novel-beam', 'ability-novel-curse', 'ability-novel-trap', 'ability-novel-array'].includes(effect.kind));
  for (const effect of effects) {
    if (effect.ttl <= 0) continue;
    const player = sim.players.find(entry => entry.id === effect.owner); const branch = player?.equipment.branches.find(entry => entry.item.id === effect.sourceId);
    if (!player || !branch || player.hp <= 0) { effect.ttl = 0; continue; }
    const level = effect.level ?? 1;
    if (effect.kind === 'ability-novel-array') continue;
    if (effect.kind === 'ability-novel-curse') {
      const target = sim.enemies.find(enemy => enemy.id === effect.targetId);
      if (!target || !living(target)) {
        const infectionAge = (effect.duration ?? 4) - effect.ttl; effect.ttl = 0; if (sim.presentationOnly || !target) continue;
        const generation = effect.generation ?? 0; const maximum = level >= 10 ? 3 : level >= 5 ? 1 : 0;
        if (generation < maximum) {
          const targets = sim.enemies.filter(enemy => living(enemy) && distance(enemy, target) <= effect.radius && !sim.effects.some(entry => entry.kind === effect.kind && entry.owner === player.id && entry.targetId === enemy.id && entry.ttl > 0));
          const selected = targets.slice(0, effect.spreadCount ?? 2);
          for (const victim of selected) {
            const age = infectionAge; const next = { ...effect, damage: (effect.damage ?? 0) * (level >= 15 && age >= 2 ? 1.1 : .85), resonancePower: 0 };
            const application = { effect: next, target: victim, generation: generation + 1 }; curse(sim, application);
            const visual: Effect = { ...effect, id: `${effect.id}-transfer-${victim.id}`, kind: 'ability-novel-transfer', x: target.x, y: target.y, facingX: victim.x, facingY: victim.y, duration: .4, ttl: .4 }; add(sim, visual);
          }
        } else if (level >= 20) {
          for (const enemy of sim.enemies) if (living(enemy) && distance(enemy, target) <= 1.5) { const event = { enemy, player, effect, damage: (effect.damage ?? 0) * .4 }; hit(sim, event, actions); }
          const visual = { ...effect, id: `${effect.id}-burst`, kind: 'ability-novel-poison-burst', radius: 1.5, ttl: .5, duration: .5 }; add(sim, visual);
        }
        continue;
      }
      effect.x = target.x; effect.y = target.y; effect.tick = (effect.tick ?? 0) - dt;
      if (effect.tick <= 0) { effect.tick = .65; const event = { enemy: target, player, effect, damage: (effect.damage ?? 0) * .22 }; hit(sim, event, actions); }
    } else if (effect.kind === 'ability-novel-beam') {
      effect.x = player.x; effect.y = player.y; effect.tick = (effect.tick ?? 0) - dt; if (effect.tick > 0) continue;
      if (player.blocking) { effect.ttl = 0; continue; }
      const pulse = effect.pulses ?? 0; if (pulse >= 5) continue;
      if (pulse > 0) { const cost = effect.paidCost ?? 0; if (player.energy < cost) { effect.ttl = 0; continue; } player.energy -= cost; }
      effect.tick = .25; effect.pulses = pulse + 1;
      const previous = sim.enemies.find(enemy => enemy.id === effect.targetId && living(enemy));
      if (!previous && level >= 15) { const next = sim.enemies.find(enemy => living(enemy) && distance(enemy, player) <= effect.radius); if (next) { const rawLength = distance(player, next); const length = Math.max(.01, rawLength); effect.targetId = next.id; effect.facingX = (next.x - player.x) / length; effect.facingY = (next.y - player.y) / length; } }
      for (const enemy of sim.enemies) {
        if (!living(enemy)) continue;
        const x = enemy.x - player.x; const y = enemy.y - player.y; const along = x * (effect.facingX ?? 1) + y * (effect.facingY ?? 0); const across = Math.abs(x * (effect.facingY ?? 0) - y * (effect.facingX ?? 1));
        if (along < 0 || along > effect.radius || across > (effect.width ?? .35) + enemy.radius) continue;
        const charged = level >= 10 && enemy.id === effect.targetId ? 1 + pulse * .1 : 1; const final = level >= 20 && pulse === 4 ? 1.6 : 1;
        const event = { enemy, player, effect, damage: (effect.damage ?? 0) * .3 * charged * final }; hit(sim, event, actions);
      }
    } else {
      effect.delay = Math.max(0, (effect.delay ?? 0) - dt); if (effect.delay > 0) continue;
      const triggered = sim.enemies.some(enemy => living(enemy) && distance(enemy, effect) <= effect.radius); if (!triggered) continue;
      effect.ttl = 0;
      for (const enemy of sim.enemies) {
        if (!living(enemy) || distance(enemy, effect) > effect.radius + enemy.radius) continue;
        const event = { enemy, player, effect, damage: effect.damage ?? 0 }; hit(sim, event, actions);
        enemy.slowUntil = Math.max(enemy.slowUntil ?? 0, sim.clock + (level >= 10 ? 2 : .8)); enemy.slowFactor = Math.max(enemy.slowFactor ?? 0, enemy.definition.rank === 'boss' ? .15 : .45);
      }
      const visual = { ...effect, id: `${effect.id}-burst`, kind: 'ability-novel-trap-burst', duration: .5, ttl: .5 }; add(sim, visual);
      const echoLevel = level >= 20 ? Math.max(5, effect.spreadCount ?? 0) : effect.spreadCount ?? 0;
      if (echoLevel) { const echo = { id: effect.id, owner: player.id, sourceId: effect.sourceId ?? '', x: effect.x, y: effect.y, radius: effect.radius, damage: effect.damage ?? 0, level: echoLevel }; aftershock(sim, echo); }
    }
  }
}
