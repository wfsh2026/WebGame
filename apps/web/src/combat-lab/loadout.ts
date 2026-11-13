import { defaultConfig } from './simulation';
import type { LabConfig } from './simulation';

export type Socket = 'heart' | 'weapon' | 'spell' | 'weapon-support' | 'spell-support';
export interface Equipment { id: string; name: string; symbol: string; description: string; detail: string; }
export interface Heart extends Equipment { capacity: number; recoveryInterval: number; recoveryAmount: number; recoveryCost: number }
export interface ActionEquipment extends Equipment { interval: number; cost: number; damage: number }
export interface Loadout { heart: string | null; weapon: string | null; spell: string | null; weaponSupport: LabConfig['weaponSupport']; spellSupport: LabConfig['spellSupport'] }

export const hearts: Heart[] = [
  { id: 'stream', name: '归流心法', symbol: '◉', description: '均衡供能，适合观察两条能力分支的竞争。', detail: '容量 60 · 每 2 秒恢复 24 灵力 / 消耗 12 魔法值', capacity: 60, recoveryInterval: 2000, recoveryAmount: 24, recoveryCost: 12 },
  { id: 'spring', name: '涌泉心法', symbol: '≋', description: '容量较小，恢复频繁。更适合低消耗的持续攻击。', detail: '容量 36 · 每 1 秒恢复 18 灵力 / 消耗 10 魔法值', capacity: 36, recoveryInterval: 1000, recoveryAmount: 18, recoveryCost: 10 },
  { id: 'ocean', name: '藏海心法', symbol: '◎', description: '储备充足，恢复缓慢。可以爆发，但容易进入供能空档。', detail: '容量 120 · 每 3 秒恢复 24 灵力 / 消耗 12 魔法值', capacity: 120, recoveryInterval: 3000, recoveryAmount: 24, recoveryCost: 12 },
];
export const weapons: ActionEquipment[] = [
  { id: 'blade', name: '飞刃', symbol: '↗', description: '稳定的远程武器，独立计时并从心法取用灵力。', detail: '间隔 1 秒 · 消耗 8 灵力 · 伤害 40 · 1 个辅助格', interval: 1000, cost: 8, damage: 40 },
  { id: 'swift', name: '疾风刃', symbol: '»', description: '更快的攻击频率，也更容易争抢心法中的灵力。', detail: '间隔 0.5 秒 · 消耗 6 灵力 · 伤害 24 · 1 个辅助格', interval: 500, cost: 6, damage: 24 },
];
export const spells: ActionEquipment[] = [
  { id: 'fire', name: '火球', symbol: '✦', description: '以较高的单次消耗，换取更强的命中效果。', detail: '间隔 1.6 秒 · 消耗 14 灵力 · 伤害 60 · 1 个辅助格', interval: 1600, cost: 14, damage: 60 },
  { id: 'star', name: '星芒', symbol: '✧', description: '低消耗法术，适合与武器维持共同输出。', detail: '间隔 1.2 秒 · 消耗 7 灵力 · 伤害 32 · 1 个辅助格', interval: 1200, cost: 7, damage: 32 },
];
export const weaponSupports: Equipment[] = [
  { id: 'power', name: '过载', symbol: '↑', description: '提高所属武器伤害，同时争用更多灵力。', detail: '伤害 ×1.5 · 消耗 ×1.5' },
  { id: 'economy', name: '节能', symbol: '◇', description: '牺牲部分伤害，缓解所属武器的灵力需求。', detail: '伤害 ×0.75 · 消耗 ×0.65' },
];
export const spellSupports: Equipment[] = [
  { id: 'multi', name: '多重投射', symbol: '⋮', description: '所属法术发射 3 枚投射物，提高总消耗。', detail: '3 发 · 每发伤害 ×0.6 · 总消耗 ×1.6' },
  { id: 'economy', name: '节能', symbol: '◇', description: '只降低所属法术的消耗，不影响武器分支。', detail: '伤害 ×0.75 · 消耗 ×0.65' },
];
export const initialLoadout: Loadout = { heart: null, weapon: null, spell: null, weaponSupport: 'none', spellSupport: 'none' };

export function toConfig(loadout: Loadout): LabConfig {
  const heart = hearts.find((item) => item.id === loadout.heart) ?? hearts[0];
  const weapon = weapons.find((item) => item.id === loadout.weapon) ?? weapons[0];
  const spell = spells.find((item) => item.id === loadout.spell) ?? spells[0];
  return { ...defaultConfig, capacity: heart.capacity, initialPool: heart.capacity, recoveryInterval: heart.recoveryInterval, recoveryAmount: heart.recoveryAmount, recoveryCost: heart.recoveryCost,
    weaponEnabled: loadout.heart !== null && loadout.weapon !== null, spellEnabled: loadout.heart !== null && loadout.spell !== null,
    weaponName: weapon.name, spellName: spell.name, weaponDamage: weapon.damage, spellDamage: spell.damage,
    weaponInterval: weapon.interval, weaponCost: weapon.cost, spellInterval: spell.interval, spellCost: spell.cost,
    weaponSupport: loadout.weaponSupport, spellSupport: loadout.spellSupport };
}

export function getInventory(socket: Socket): Equipment[] {
  if (socket === 'heart') return hearts;
  if (socket === 'weapon') return weapons;
  if (socket === 'spell') return spells;
  return socket === 'weapon-support' ? weaponSupports : spellSupports;
}
