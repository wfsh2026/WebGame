import type { Player } from './index';

export interface ResonanceState { supportLevel?: number; relayCount?: number; relayLeft?: number; finisher?: boolean; cycleCount?: number; recoveryCharges?: number; lastKind: string; lastAge: number; energyBoost: number; cooldown: number; buffKind: string; buffPower: number; buffLeft: number; buffSource: string }
export interface ThunderMark { residual?: boolean; charged?: boolean; transfer?: boolean; remaining: number; power: number }
export function resonanceState(player: Player): ResonanceState {
  player.resonance ??= { lastKind: '', lastAge: 10, energyBoost: 0, cooldown: 0, buffKind: '', buffPower: 0, buffLeft: 0, buffSource: '' };
  return player.resonance;
}
export function updateResonance(player: Player, dt: number): void {
  const state = resonanceState(player);
  state.relayLeft = Math.max(0, (state.relayLeft ?? 0) - dt); if (!state.relayLeft) state.relayCount = 0;
  state.lastAge += dt; state.cooldown = Math.max(0, state.cooldown - dt); state.buffLeft = Math.max(0, state.buffLeft - dt);
  const source = player.equipment.branches.find(branch => branch.item.id === state.buffSource && branch.resonance > 0);
  if (!source || player.hp <= 0) state.buffLeft = 0;
  if (player.hp <= 0 || player.equipment.heartItem?.effect !== 'cycle') { state.energyBoost = 0; state.lastKind = ''; }
}
export function consumeResonance(player: Player, kind: string): number {
  const state = resonanceState(player);
  const source = player.equipment.branches.some(branch => branch.item.id === state.buffSource && branch.resonance > 0);
  if (state.buffLeft <= 0 || state.buffKind !== kind || !source) return 0;
  state.buffLeft = 0;
  if ((state.supportLevel ?? 0) >= 5) { state.relayCount = (state.relayCount ?? 0) + 1; state.relayLeft = (state.supportLevel ?? 0) >= 15 ? 10 : 6; }
  const power = state.buffPower * (state.finisher ? 1.5 : 1); state.finisher = false;
  return power;
}
export function recordAbilityHit(player: Player, hit: { kind: string; sourceId: string; resonance: number }): void {
  if (player.hp <= 0) return;
  const state = resonanceState(player); const heart = player.equipment.heartItem;
  if (heart?.effect === 'cycle' && state.lastKind && state.lastKind !== hit.kind && state.lastAge <= 4 && state.cooldown <= 0) {
    state.energyBoost = 2 + ((heart.level ?? 1) - 1) * .2; state.cooldown = 1;
    state.cycleCount = (state.cycleCount ?? 0) + 1;
    if ((heart.level ?? 1) >= 15 && state.cycleCount % 3 === 0) state.recoveryCharges = (heart.level ?? 1) >= 20 ? 3 : 2;
  }
  state.lastKind = hit.kind; state.lastAge = 0;
  const source = player.equipment.branches.find(branch => branch.item.id === hit.sourceId && branch.resonance > 0);
  if (hit.resonance <= 0 || !source) return;
  const power = Math.min(hit.resonance, source.resonance);
  if (state.buffLeft > 0 && state.buffPower > power) return;
  state.supportLevel = source.supportLevels.resonance ?? 1;
  state.finisher = state.supportLevel >= 10 && (state.relayCount ?? 0) >= 3;
  if (state.finisher) state.relayCount = 0;
  state.buffKind = hit.kind === 'melee' ? 'ranged' : 'melee'; state.buffPower = power; state.buffLeft = state.supportLevel >= 3 ? 6 : 4; state.buffSource = hit.sourceId;
}
