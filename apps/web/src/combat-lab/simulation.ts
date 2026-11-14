// 仅用于本地机制体验，不作为正式权威战斗实现。
export interface LabConfig {
  meleeName?: string;
  rangedName?: string;
  meleeDamage?: number;
  rangedDamage?: number;
  capacity: number;
  initialPool: number;
  recoveryInterval: number;
  recoveryAmount: number;
  speed: number;
  shortage: 'wait' | 'skip';
  priority: 'melee' | 'ranged';
  meleeEnabled: boolean;
  rangedEnabled: boolean;
  meleeInterval: number;
  rangedInterval: number;
  meleeCost: number;
  rangedCost: number;
  meleeSupport: 'none' | 'power' | 'economy';
  rangedSupport: 'none' | 'multi' | 'economy';
}

export const defaultConfig: LabConfig = {
  capacity: 60, initialPool: 40, recoveryInterval: 2000, recoveryAmount: 24,
  speed: 1, shortage: 'wait', priority: 'melee', meleeEnabled: true, rangedEnabled: true,
  meleeInterval: 1000, rangedInterval: 1600, meleeCost: 8, rangedCost: 14, meleeSupport: 'none', rangedSupport: 'none',
};

export interface Ability {
  id: 'melee' | 'ranged';
  name: string;
  enabled: boolean;
  interval: number;
  cost: number;
  damage: number;
  projectiles: number;
}

export interface LabEvent {
  id: number;
  time: number;
  kind: 'melee' | 'ranged' | 'recovery' | 'blocked';
  text: string;
  damage: number;
  projectiles: number;
}

export interface AbilityState { next: number; count: number; spent: number; blocked: boolean }
export interface LabState {
  time: number;
  pool: number;
  nextRecovery: number;
  damage: number;
  sequence: number;
  melee: AbilityState;
  ranged: AbilityState;
  events: LabEvent[];
}

export function getAbilities(config: LabConfig): Ability[] {
  const meleeInterval = Math.round(config.meleeInterval / config.speed);
  const rangedInterval = Math.round(config.rangedInterval / config.speed);
  const meleeCost = config.meleeCost * (config.meleeSupport === 'power' ? 1.5 : config.meleeSupport === 'economy' ? 0.65 : 1);
  const rangedCost = config.rangedCost * (config.rangedSupport === 'multi' ? 1.6 : config.rangedSupport === 'economy' ? 0.65 : 1);
  const meleeDamage = (config.meleeDamage ?? 40) * (config.meleeSupport === 'power' ? 1.5 : config.meleeSupport === 'economy' ? 0.75 : 1);
  const rangedDamage = (config.rangedDamage ?? 60) * (config.rangedSupport === 'multi' ? 0.6 : config.rangedSupport === 'economy' ? 0.75 : 1);
  return [
    { id: 'melee', name: config.meleeName ?? '斩击', enabled: config.meleeEnabled, interval: meleeInterval, cost: meleeCost, damage: meleeDamage, projectiles: 1 },
    { id: 'ranged', name: config.rangedName ?? '火球', enabled: config.rangedEnabled, interval: rangedInterval, cost: rangedCost, damage: rangedDamage, projectiles: config.rangedSupport === 'multi' ? 3 : 1 },
  ];
}

export function createLabState(config: LabConfig): LabState {
  const abilities = getAbilities(config);
  const initialPool = Math.min(config.capacity, config.initialPool);
  return { time: 0, pool: initialPool, nextRecovery: config.recoveryInterval, damage: 0, sequence: 0,
    melee: { next: abilities[0].interval, count: 0, spent: 0, blocked: false },
    ranged: { next: abilities[1].interval, count: 0, spent: 0, blocked: false }, events: [] };
}

function record(state: LabState, event: Omit<LabEvent, 'id' | 'time'>) {
  state.sequence += 1;
  const item = { ...event, id: state.sequence, time: state.time };
  const events = [item, ...state.events];
  state.events = events.slice(0, 100);
}

export function stepLab(previous: LabState, config: LabConfig): LabState {
  const state: LabState = { ...previous, time: previous.time + 50, melee: { ...previous.melee }, ranged: { ...previous.ranged }, events: [...previous.events] };
  if (state.time >= state.nextRecovery) {
    state.nextRecovery += config.recoveryInterval;
    const missing = config.capacity - state.pool;
    const amount = Math.min(missing, config.recoveryAmount);
    if (amount > 0) {
      state.pool += amount;
      const restored = amount.toFixed(1);
      const detail = { kind: 'recovery' as const, text: `心法恢复 +${restored} 灵力`, damage: 0, projectiles: 0 };
      record(state, detail);
    }
  }
  const abilities = getAbilities(config);
  if (config.priority === 'ranged') abilities.reverse();
  for (const ability of abilities) {
    const branch = state[ability.id];
    if (!ability.enabled || state.time < branch.next) continue;
    if (state.pool + 0.000001 < ability.cost) {
      if (!branch.blocked || config.shortage === 'skip') {
        const detail = { kind: 'blocked' as const, text: `${ability.name}灵力不足：${config.shortage === 'wait' ? '等待供能' : '本次空过，重新计时'}`, damage: 0, projectiles: 0 };
        record(state, detail);
      }
      branch.blocked = true;
      if (config.shortage === 'skip') branch.next = state.time + ability.interval;
      continue;
    }
    state.pool = Math.max(0, state.pool - ability.cost);
    const damage = ability.damage * ability.projectiles;
    state.damage += damage;
    branch.next = state.time + ability.interval;
    branch.count += 1;
    branch.spent += ability.cost;
    branch.blocked = false;
    const detail = { kind: ability.id, text: `${ability.name}执行，消耗 ${ability.cost.toFixed(1)} 灵力，命中 ${damage} 伤害`, damage, projectiles: ability.projectiles };
    record(state, detail);
  }
  return state;
}
