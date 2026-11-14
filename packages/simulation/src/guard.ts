import type { Player } from './index';

export const perfectGuardSeconds = .25;
export const counterSeconds = 10;
export interface GuardState { windowLeft: number; counterLeft: number; press: number; held: boolean; triggered: boolean }
export interface GuardHit { damage: number; kind: 'hurt' | 'block' | 'perfect-block' }

export function guardState(player: Player): GuardState {
  player.guard ??= { windowLeft: 0, counterLeft: 0, press: 0, held: false, triggered: false };
  return player.guard;
}

export function stepGuard(player: Player, dt: number): void {
  const state = guardState(player);
  state.counterLeft = Math.max(0, state.counterLeft - dt);
  state.windowLeft = Math.max(0, state.windowLeft - dt);
  if (state.counterLeft < .000001) state.counterLeft = 0;
  if (state.windowLeft < .000001) state.windowLeft = 0;
  const press = player.input.blockPress ?? 0;
  if (!player.blocking) { state.windowLeft = 0; state.triggered = false; }
  else if (!state.held || press !== state.press) { state.windowLeft = perfectGuardSeconds; state.triggered = false; }
  state.held = player.blocking; state.press = press;
  if (player.hp <= 0) resetGuard(player);
}

export function resetGuard(player: Player): void {
  const state = guardState(player);
  state.windowLeft = 0; state.counterLeft = 0; state.held = false; state.triggered = false;
  state.press = player.input.blockPress ?? 0;
}

export function guardHit(player: Player, damage: number): GuardHit {
  if (!player.blocking || damage <= 0) return { damage, kind: 'hurt' };
  const state = guardState(player);
  if (state.windowLeft <= 0) return { damage: damage * .5, kind: 'block' };
  const first = !state.triggered;
  if (first) { state.counterLeft = counterSeconds; state.triggered = true; }
  return { damage: 0, kind: first ? 'perfect-block' : 'block' };
}

export function counterDamage(player: Player | undefined): number {
  return player && player.hp > 0 && (player.guard?.counterLeft ?? 0) > 0 ? 2 : 1;
}
