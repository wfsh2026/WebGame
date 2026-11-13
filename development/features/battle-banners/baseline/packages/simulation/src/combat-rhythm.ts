import type { AbilityState, Player, Simulation } from './index';
export interface AbilityProgress { origin: number; spent: boolean; idle: number; started: boolean; starved: number; released: boolean; stacks: number; quiet: number; charges: number; overload: number; overloadCast: number; landed: number; retain: number; staff: number }
export interface HeartProgress { cooldown: number; low: number; burst: number; idle: number }
export function abilityProgress(state: AbilityState): AbilityProgress {
  state.progress ??= { origin: 0, spent: false, idle: 0, started: false, starved: 0, released: false, stacks: 0, quiet: 0, charges: 0, overload: 0, overloadCast: 0, landed: 0, retain: 0, staff: 0 };
  return state.progress;
}
export function attackInterval(player: Player, branch: Player['equipment']['branches'][number], state?: AbilityState): number {
  const haste = branch.supportLevels.haste ?? 0; const stacks = state?.progress?.stacks ?? 0;
  const speed = branch.item.kind === 'weapon' ? player.stats.attackSpeed : player.stats.castingSpeed;
  const rapid = haste >= 20 && stacks >= 5 && ((state?.count ?? 0) - (state?.progress?.origin ?? 0) + 1) % 5 === 0 ? .5 : 1;
  return branch.item.interval * branch.intervalMultiplier / speed / (1 + stacks * .04) * rapid;
}
export function castModifiers(player: Player, branch: Player['equipment']['branches'][number], state: AbilityState) {
  const progress = abilityProgress(state); const economy = branch.supportLevels.economy ?? 0;
  const discount = economy >= 3 && progress.starved >= .5 || economy >= 5 && progress.charges > 0 && player.energy < player.capacity * .5;
  const factor = discount ? economy >= 20 ? .8 : .9 : 1;
  const resonance = player.resonance;
  const relay = resonance && resonance.buffLeft > 0 && resonance.buffKind === branch.item.kind && resonance.finisher && (resonance.supportLevel ?? 0) >= 20 ? .8 : 1;
  const cost = branch.item.cost * branch.costMultiplier * factor * relay;
  const overloaded = progress.overload > 0 && progress.overloadCast === 0;
  return { cost, saved: Boolean(discount && progress.charges > 0), damage: overloaded ? 1.2 : 1, overloaded };
}
export function prepareRhythm(sim: Simulation, player: Player, dt: number): void {
  const heart = player.heartProgress ??= { cooldown: 0, low: 0, burst: 0, idle: 3 };
  heart.cooldown = Math.max(0, heart.cooldown - dt); heart.burst = Math.max(0, heart.burst - dt);
  heart.low = player.energy < player.capacity * .25 ? heart.low + dt : 0;
  const eligible = player.equipment.branches.filter(branch => sim.enemies.some(enemy => {
    if (enemy.hp <= 0 || enemy.state === 'detonating' || enemy.state === 'escaped') return false;
    const dx = enemy.x - player.x; const dy = enemy.y - player.y; const distance = Math.hypot(dx, dy);
    const reach = branch.item.effect === 'spear' ? 3.6 : branch.item.range ?? 0;
    return distance <= reach * (branch.item.kind === 'weapon' ? branch.areaMultiplier : 1);
  }));
  eligible.sort((a, b) => {
    const priorityA = a.item.effect === 'thunder-seal' ? -.1 : a.item.interval;
    const priorityB = b.item.effect === 'thunder-seal' ? -.1 : b.item.interval;
    return priorityA - priorityB;
  });
  const entering = heart.idle >= 3; heart.idle = eligible.length ? 0 : heart.idle + dt;
  for (const branch of player.equipment.branches) {
    let state = player.abilityStates.find(entry => entry.itemId === branch.item.id);
    if (!state) { state = { itemId: branch.item.id, remaining: 0, count: 0, state: '就绪' }; player.abilityStates.push(state); }
    const progress = abilityProgress(state); const index = eligible.indexOf(branch);
    if (progress.overloadCast > 0) {
      const castId = `${player.id}-${branch.item.id}-${progress.overloadCast}`;
      const flying = sim.projectiles.some(shot => shot.castId === castId && shot.ttl > 0);
      if (!flying) progress.overloadCast = 0;
    }
    progress.quiet += dt; progress.overload = Math.max(0, progress.overload - dt); progress.retain = Math.max(0, progress.retain - dt);
    if (index < 0) progress.idle += dt; else progress.idle = 0;
    const haste = branch.supportLevels.haste ?? 0; const hold = haste >= 15 && progress.starved > 0 ? 4 : haste >= 10 ? 2 : 1;
    if (progress.quiet > hold) { progress.stacks = Math.max(0, progress.stacks - dt * 2); }
    if (progress.idle >= 3) { progress.started = false; if (progress.retain <= 0) { progress.origin = state.count; progress.landed = 0; } }
    if (index >= 0 && (entering || !progress.started)) {
      const interval = attackInterval(player, branch, state); const offset = Math.min(index * .1, interval * .4);
      state.remaining = Math.max(state.remaining, offset); progress.started = true;
    }
  }
}
export function commitCast(player: Player, branch: Player['equipment']['branches'][number], state: AbilityState): void {
  const progress = abilityProgress(state); const levels = branch.supportLevels;
  if ((levels.economy ?? 0) >= 5) {
    if (progress.spent && progress.charges > 0) progress.charges -= 1;
    const cadence = levels.economy >= 15 ? 3 : 4;
    if ((state.count - progress.origin) % cadence === 0) progress.charges = Math.min(levels.economy >= 10 ? 2 : 1, progress.charges + 1);
  }
  const haste = levels.haste ?? 0;
  if (haste >= 3) progress.stacks = Math.min(haste >= 5 ? 5 : 3, progress.stacks + 1);
  const overload = levels.overload ?? 0;
  if (progress.overload > 0 && overload < 15) progress.overload = 0;
  const cadence = overload >= 20 ? 2 : overload >= 5 ? 3 : 4;
  if (overload >= 3 && progress.overload <= 0 && (state.count - progress.origin) % cadence === 0) progress.overload = overload >= 15 ? 6 : 3;
  progress.quiet = 0; progress.starved = 0; progress.released = false;
}
export function heartConversion(player: Player): { amount: number; interval: number; empowered: boolean } {
  const item = player.equipment.heartItem; if (!item) return { amount: 0, interval: 1, empowered: false };
  const state = player.heartProgress ??= { cooldown: 0, low: 0, burst: 0, idle: 3 };
  const id = item.definitionId ?? item.id; const level = item.level ?? 1;
  let factor = 1; let interval = item.interval;
  if (item.effect !== 'cycle' && level >= 15 && state.cooldown <= 0 && state.low >= (id.endsWith('/spring') ? 1 : .3)) {
    state.burst = id.endsWith('/spring') ? 2 : .1; state.cooldown = id.endsWith('/ocean') ? 6 : 4;
  }
  if (state.burst > 0) {
    if (id.endsWith('/spring')) interval *= level >= 20 ? .65 : .8;
    else factor = id.endsWith('/ocean') ? level >= 20 ? 1.8 : 1.5 : level >= 20 ? 1.4 : 1.2;
  }
  const relay = player.resonance;
  if (item.effect === 'cycle' && (relay?.recoveryCharges ?? 0) > 0) factor *= level >= 20 ? 1.3 : 1.15;
  return { amount: item.recovery * factor, interval, empowered: factor > 1 || interval < item.interval };
}
