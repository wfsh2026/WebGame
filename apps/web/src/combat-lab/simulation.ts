// 仅用于本地机制体验，不作为正式权威战斗实现。
export interface LabConfig {
  weaponName?: string;
  spellName?: string;
  weaponDamage?: number;
  spellDamage?: number;
  mana: number;
  capacity: number;
  initialPool: number;
  recoveryInterval: number;
  recoveryAmount: number;
  recoveryCost: number;
  speed: number;
  shortage: 'wait' | 'skip';
  priority: 'weapon' | 'spell';
  weaponEnabled: boolean;
  spellEnabled: boolean;
  weaponInterval: number;
  spellInterval: number;
  weaponCost: number;
  spellCost: number;
  weaponSupport: 'none' | 'power' | 'economy';
  spellSupport: 'none' | 'multi' | 'economy';
}

export const defaultConfig: LabConfig = {
  mana: 300, capacity: 60, initialPool: 40, recoveryInterval: 2000, recoveryAmount: 24, recoveryCost: 12,
  speed: 1, shortage: 'wait', priority: 'weapon', weaponEnabled: true, spellEnabled: true,
  weaponInterval: 1000, spellInterval: 1600, weaponCost: 8, spellCost: 14, weaponSupport: 'none', spellSupport: 'none',
};

export interface Ability {
  id: 'weapon' | 'spell';
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
  kind: 'weapon' | 'spell' | 'recovery' | 'blocked';
  text: string;
  damage: number;
  projectiles: number;
}

export interface AbilityState { next: number; count: number; spent: number; blocked: boolean }
export interface LabState {
  time: number;
  mana: number;
  pool: number;
  nextRecovery: number;
  converted: number;
  manaSpent: number;
  damage: number;
  sequence: number;
  weapon: AbilityState;
  spell: AbilityState;
  events: LabEvent[];
}

export function getAbilities(config: LabConfig): Ability[] {
  const weaponInterval = Math.round(config.weaponInterval / config.speed);
  const spellInterval = Math.round(config.spellInterval / config.speed);
  const weaponCost = config.weaponCost * (config.weaponSupport === 'power' ? 1.5 : config.weaponSupport === 'economy' ? 0.65 : 1);
  const spellCost = config.spellCost * (config.spellSupport === 'multi' ? 1.6 : config.spellSupport === 'economy' ? 0.65 : 1);
  const weaponDamage = (config.weaponDamage ?? 40) * (config.weaponSupport === 'power' ? 1.5 : config.weaponSupport === 'economy' ? 0.75 : 1);
  const spellDamage = (config.spellDamage ?? 60) * (config.spellSupport === 'multi' ? 0.6 : config.spellSupport === 'economy' ? 0.75 : 1);
  return [
    { id: 'weapon', name: config.weaponName ?? '飞刃', enabled: config.weaponEnabled, interval: weaponInterval, cost: weaponCost, damage: weaponDamage, projectiles: 1 },
    { id: 'spell', name: config.spellName ?? '火球', enabled: config.spellEnabled, interval: spellInterval, cost: spellCost, damage: spellDamage, projectiles: config.spellSupport === 'multi' ? 3 : 1 },
  ];
}

export function createLabState(config: LabConfig): LabState {
  const abilities = getAbilities(config);
  const initialPool = Math.min(config.capacity, config.initialPool);
  return { time: 0, mana: config.mana, pool: initialPool, nextRecovery: config.recoveryInterval, converted: 0, manaSpent: 0, damage: 0, sequence: 0,
    weapon: { next: abilities[0].interval, count: 0, spent: 0, blocked: false },
    spell: { next: abilities[1].interval, count: 0, spent: 0, blocked: false }, events: [] };
}

function record(state: LabState, event: Omit<LabEvent, 'id' | 'time'>) {
  state.sequence += 1;
  const item = { ...event, id: state.sequence, time: state.time };
  const events = [item, ...state.events];
  state.events = events.slice(0, 100);
}

export function stepLab(previous: LabState, config: LabConfig): LabState {
  const state: LabState = { ...previous, time: previous.time + 50, weapon: { ...previous.weapon }, spell: { ...previous.spell }, events: [...previous.events] };
  if (state.time >= state.nextRecovery) {
    state.nextRecovery += config.recoveryInterval;
    const missing = config.capacity - state.pool;
    const amount = Math.min(missing, config.recoveryAmount);
    const cost = config.recoveryCost * amount / config.recoveryAmount;
    if (amount > 0 && state.mana + 0.000001 >= cost) {
      state.mana = Math.max(0, state.mana - cost);
      state.pool += amount;
      state.converted += amount;
      state.manaSpent += cost;
      const detail = { kind: 'recovery' as const, text: `心法恢复 +${amount.toFixed(1)} 灵力，消耗 ${cost.toFixed(1)} 魔法值`, damage: 0, projectiles: 0 };
      record(state, detail);
    } else {
      const detail = { kind: 'blocked' as const, text: amount <= 0 ? '灵力池已满，本次恢复不扣魔法值' : '魔法值不足以支付本次恢复，本次不转换', damage: 0, projectiles: 0 };
      record(state, detail);
    }
  }
  const abilities = getAbilities(config);
  if (config.priority === 'spell') abilities.reverse();
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

