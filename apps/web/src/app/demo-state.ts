import { finalCoins, finalMaterials, getRift, restDuration } from './demo-data';
import type { RiftId, RoleId } from './demo-data';

export type Stage = 'account' | 'role' | 'lobby' | 'room' | 'rest' | 'play' | 'round-result' | 'final-result';
export type LobbyTab = 'explore' | 'character' | 'supplies' | 'history';

export interface Profile {
  name: string;
  role: RoleId;
  coins: number;
  materials: number;
  level: number;
  supplies: number;
  runs: number;
}

export interface DemoState {
  stage: Stage;
  profile: Profile | null;
  draftName: string;
  tab: LobbyTab;
  riftId: RiftId;
  partySize: number;
  round: number;
  seconds: number;
  scores: number[];
  growth: string[];
}

export type DemoAction =
  | { type: 'register'; name: string }
  | { type: 'choose-role'; role: RoleId }
  | { type: 'tab'; tab: LobbyTab }
  | { type: 'create-room'; riftId: RiftId }
  | { type: 'add-companion' }
  | { type: 'leave-room' }
  | { type: 'start' }
  | { type: 'tick' }
  | { type: 'grow'; choice: string }
  | { type: 'round-complete' }
  | { type: 'continue' }
  | { type: 'return-lobby' }
  | { type: 'upgrade' }
  | { type: 'buy' }
  | { type: 'sign-out' };

const storageKey = 'web-game-world.demo-profile.v1';

function readProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    if (!('name' in value) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 12) return null;
    if (!('role' in value) || (value.role !== 'ranger' && value.role !== 'guardian' && value.role !== 'mage')) return null;
    const fields = ['coins', 'materials', 'level', 'supplies', 'runs'];
    for (const field of fields) {
      if (!(field in value)) return null;
      const item: unknown = Reflect.get(value, field);
      const integer = Number.isSafeInteger(item);
      if (typeof item !== 'number' || !integer || item < 0 || item > 1000000) return null;
    }
    if (!('coins' in value) || typeof value.coins !== 'number' || !('materials' in value) || typeof value.materials !== 'number') return null;
    if (!('level' in value) || typeof value.level !== 'number' || !('supplies' in value) || typeof value.supplies !== 'number') return null;
    if (!('runs' in value) || typeof value.runs !== 'number') return null;
    return { name: value.name, role: value.role, coins: value.coins, materials: value.materials, level: value.level, supplies: value.supplies, runs: value.runs };
  } catch {
    return null;
  }
}

export function persistProfile(profile: Profile | null): boolean {
  try {
    if (profile) {
      const serialized = JSON.stringify(profile);
      localStorage.setItem(storageKey, serialized);
    } else localStorage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}

export function initialState(): DemoState {
  const profile = readProfile();
  return { stage: profile ? 'lobby' : 'account', profile, draftName: '', tab: 'explore', riftId: 'forest', partySize: 1, round: 0, seconds: restDuration, scores: [], growth: [] };
}

// 仅负责本地交互原型。正式阶段推进、积分及资产必须接入权威服务。
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'register': {
      if (state.stage !== 'account') return state;
      const name = action.name.trim();
      if (!name || name.length > 12) return state;
      return { ...state, stage: 'role', draftName: name };
    }
    case 'choose-role':
      if (state.stage !== 'role') return state;
      return { ...state, stage: 'lobby', profile: { name: state.draftName, role: action.role, coins: 600, materials: 12, level: 1, supplies: 0, runs: 0 } };
    case 'tab':
      return state.stage === 'lobby' ? { ...state, tab: action.tab } : state;
    case 'create-room':
      if (state.stage !== 'lobby') return state;
      return { ...state, stage: 'room', riftId: action.riftId, partySize: 1, round: 0, scores: [], growth: [] };
    case 'add-companion':
      return state.stage === 'room' ? { ...state, partySize: Math.min(4, state.partySize + 1) } : state;
    case 'leave-room':
      return state.stage === 'room' ? { ...state, stage: 'lobby' } : state;
    case 'start':
      return state.stage === 'room' && state.partySize > 1 ? { ...state, stage: 'rest', seconds: restDuration } : state;
    case 'tick':
      if (state.stage !== 'rest') return state;
      return state.seconds <= 1 ? { ...state, stage: 'play', seconds: 0 } : { ...state, seconds: state.seconds - 1 };
    case 'grow':
      if (state.stage !== 'rest' || state.round === 0 || state.growth.length >= state.round) return state;
      return { ...state, growth: [...state.growth, action.choice] };
    case 'round-complete':
      if (state.stage !== 'play') return state;
      return { ...state, stage: 'round-result', scores: [...state.scores, 500 + state.round * 150] };
    case 'continue': {
      if (state.stage !== 'round-result') return state;
      const rift = getRift(state.riftId);
      if (state.round + 1 >= rift.rounds.length) return { ...state, stage: 'final-result' };
      return { ...state, stage: 'rest', round: state.round + 1, seconds: restDuration };
    }
    case 'return-lobby': {
      if (state.stage !== 'final-result' || !state.profile) return state;
      const profile = { ...state.profile, coins: state.profile.coins + finalCoins, materials: state.profile.materials + finalMaterials, runs: state.profile.runs + 1 };
      return { ...state, stage: 'lobby', tab: 'explore', profile };
    }
    case 'upgrade': {
      if (state.stage !== 'lobby' || !state.profile || state.profile.coins < 200 || state.profile.materials < 3) return state;
      const profile = { ...state.profile, coins: state.profile.coins - 200, materials: state.profile.materials - 3, level: state.profile.level + 1 };
      return { ...state, profile };
    }
    case 'buy': {
      if (state.stage !== 'lobby' || !state.profile || state.profile.coins < 60) return state;
      const profile = { ...state.profile, coins: state.profile.coins - 60, supplies: state.profile.supplies + 1 };
      return { ...state, profile };
    }
    case 'sign-out':
      return state.stage === 'lobby' ? { ...state, stage: 'account', profile: null, draftName: '' } : state;
  }
}
