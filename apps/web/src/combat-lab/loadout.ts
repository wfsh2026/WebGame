import { defaultConfig } from './simulation';
import type { LabConfig } from './simulation';

export type Socket = 'heart' | 'melee' | 'ranged' | 'melee-support' | 'ranged-support';
export interface Equipment { id: string; name: string; symbol: string; description: string; detail: string; }
export interface Heart extends Equipment { capacity: number; recoveryInterval: number; recoveryAmount: number }
export interface ActionEquipment extends Equipment { interval: number; cost: number; damage: number }
export interface Loadout { heart: string | null; melee: string | null; ranged: string | null; meleeSupport: LabConfig['meleeSupport']; rangedSupport: LabConfig['rangedSupport'] }

export const hearts: Heart[] = [
  { id: 'stream', name: '归流心法', symbol: '◉', description: '均衡供能，适合观察两条能力分支的竞争。', detail: '容量 60 · 每 2 秒恢复 24 灵力', capacity: 60, recoveryInterval: 2000, recoveryAmount: 24 },
  { id: 'spring', name: '涌泉心法', symbol: '≋', description: '容量较小，恢复频繁。更适合低消耗的持续攻击。', detail: '容量 36 · 每 1 秒恢复 18 灵力', capacity: 36, recoveryInterval: 1000, recoveryAmount: 18 },
  { id: 'ocean', name: '藏海心法', symbol: '◎', description: '储备充足，恢复缓慢。可以爆发，但容易进入供能空档。', detail: '容量 120 · 每 3 秒恢复 24 灵力', capacity: 120, recoveryInterval: 3000, recoveryAmount: 24 },
];
export const melees: ActionEquipment[] = [
  { id: 'blade', name: '斩击', symbol: '↗', description: '稳定的近战技能，独立计时并从心法取用灵力。', detail: '间隔 1 秒 · 消耗 8 灵力 · 伤害 40 · 1 个辅助格', interval: 1000, cost: 8, damage: 40 },
  { id: 'swift', name: '疾风刃', symbol: '»', description: '更快的攻击频率，也更容易争抢心法中的灵力。', detail: '间隔 0.5 秒 · 消耗 6 灵力 · 伤害 24 · 1 个辅助格', interval: 500, cost: 6, damage: 24 },
];
export const rangeds: ActionEquipment[] = [
  { id: 'fire', name: '火球', symbol: '✦', description: '以较高的单次消耗，换取更强的命中效果。', detail: '间隔 1.6 秒 · 消耗 14 灵力 · 伤害 60 · 1 个辅助格', interval: 1600, cost: 14, damage: 60 },
  { id: 'star', name: '星芒', symbol: '✧', description: '低消耗远程技能，适合与近战技能维持共同输出。', detail: '间隔 1.2 秒 · 消耗 7 灵力 · 伤害 32 · 1 个辅助格', interval: 1200, cost: 7, damage: 32 },
];
export const meleeSupports: Equipment[] = [
  { id: 'power', name: '过载', symbol: '↑', description: '提高所属近战技能伤害，同时争用更多灵力。', detail: '伤害 ×1.5 · 消耗 ×1.5' },
  { id: 'economy', name: '节能', symbol: '◇', description: '牺牲部分伤害，缓解所属近战技能的灵力需求。', detail: '伤害 ×0.75 · 消耗 ×0.65' },
];
export const rangedSupports: Equipment[] = [
  { id: 'multi', name: '多重投射', symbol: '⋮', description: '所属远程技能发射 3 枚投射物，提高总消耗。', detail: '3 发 · 每发伤害 ×0.6 · 总消耗 ×1.6' },
  { id: 'economy', name: '节能', symbol: '◇', description: '只降低所属远程技能的消耗，不影响近战技能分支。', detail: '伤害 ×0.75 · 消耗 ×0.65' },
];
export const initialLoadout: Loadout = { heart: null, melee: null, ranged: null, meleeSupport: 'none', rangedSupport: 'none' };

export function toConfig(loadout: Loadout): LabConfig {
  const heart = hearts.find((item) => item.id === loadout.heart) ?? hearts[0];
  const melee = melees.find((item) => item.id === loadout.melee) ?? melees[0];
  const ranged = rangeds.find((item) => item.id === loadout.ranged) ?? rangeds[0];
  return { ...defaultConfig, capacity: heart.capacity, initialPool: heart.capacity, recoveryInterval: heart.recoveryInterval, recoveryAmount: heart.recoveryAmount,
    meleeEnabled: loadout.heart !== null && loadout.melee !== null, rangedEnabled: loadout.heart !== null && loadout.ranged !== null,
    meleeName: melee.name, rangedName: ranged.name, meleeDamage: melee.damage, rangedDamage: ranged.damage,
    meleeInterval: melee.interval, meleeCost: melee.cost, rangedInterval: ranged.interval, rangedCost: ranged.cost,
    meleeSupport: loadout.meleeSupport, rangedSupport: loadout.rangedSupport };
}

export function getInventory(socket: Socket): Equipment[] {
  if (socket === 'heart') return hearts;
  if (socket === 'melee') return melees;
  if (socket === 'ranged') return rangeds;
  return socket === 'melee-support' ? meleeSupports : rangedSupports;
}
