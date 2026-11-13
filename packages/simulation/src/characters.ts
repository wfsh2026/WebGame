export interface CharacterPoints { power: number; magic: number; vitality: number; spirit: number; movement: number; haste: number; luck: number }
export type CharacterAttribute = keyof CharacterPoints;
export interface CharacterBuild { name: string; description: string; points: CharacterPoints; talents: string[] }
export interface CharacterStats { maxHp: number; maxMp: number; physicalAttack: number; magicalAttack: number; physicalDefense: number; magicalDefense: number; movementSpeed: number; attackSpeed: number; castingSpeed: number; luck: number }
export interface CharacterTalent { id: string; name: string; icon: string; effect: string; detail: string; cost: number; opposite?: string; modifiers: Partial<CharacterStats> }
export const characterRulesVersion = 'talents-v1';
// 当前起始心法每秒消耗至多 4 魔法，角色每秒恢复 5；浅池不产生持续供能代价。
export const startingLoadoutAllowsShallow = false;
export const characterAttributes: CharacterAttribute[] = ['power', 'magic', 'vitality', 'spirit', 'movement', 'haste', 'luck'];
export const defaultCharacterPoints: CharacterPoints = { power: 8, magic: 0, vitality: 5, spirit: 2, movement: 2, haste: 2, luck: 1 };
export const characterTalents: CharacterTalent[] = [
  { id: 'brute', name: '蛮力', icon: '斩', effect: '物理攻击 +6', detail: '强化物理输出，不额外增加力量。', cost: 3, modifiers: { physicalAttack: 6 } },
  { id: 'arcane', name: '通玄', icon: '玄', effect: '魔法攻击 +6', detail: '强化法术威力，不改变施法与供能。', cost: 3, modifiers: { magicalAttack: 6 } },
  { id: 'healthy', name: '强健', icon: '生', effect: '最大生命 +40', detail: '增加生命储备，不额外增加物防。', cost: 3, opposite: 'frail', modifiers: { maxHp: 40 } },
  { id: 'reservoir', name: '蓄魔', icon: '泉', effect: '最大魔法 +20', detail: '增加魔法储备，不改变魔防和恢复。', cost: 3, opposite: 'shallow', modifiers: { maxMp: 20 } },
  { id: 'light', name: '轻盈', icon: '羽', effect: '移动速度 +0.06 m/s', detail: '只影响普通移动，不改变冲刺。', cost: 4, opposite: 'slow', modifiers: { movementSpeed: 0.06 } },
  { id: 'weapon', name: '武器熟练', icon: '锋', effect: '攻击速度倍率 +0.04', detail: '只影响武器，实际频率仍受供能限制。', cost: 2, modifiers: { attackSpeed: 0.04 } },
  { id: 'casting', name: '施法熟练', icon: '咒', effect: '施法速度倍率 +0.04', detail: '只影响法术，不增加心法供给。', cost: 2, modifiers: { castingSpeed: 0.04 } },
  { id: 'frail', name: '薄命', icon: '裂', effect: '最大生命 −40', detail: '降低生存容错，与「强健」互斥。', cost: -2, opposite: 'healthy', modifiers: { maxHp: -40 } },
  { id: 'slow', name: '迟缓', icon: '滞', effect: '移动速度 −0.06 m/s', detail: '降低普通移速，与「轻盈」互斥。', cost: -2, opposite: 'light', modifiers: { movementSpeed: -0.06 } },
  { id: 'shallow', name: '浅池', icon: '涸', effect: '最大魔法 −20', detail: '仅适用于使用角色魔法供能的构筑。', cost: -1, opposite: 'reservoir', modifiers: { maxMp: -20 } }
];

export function characterBudget(build: CharacterBuild, usesMagic = true) {
  const errors: string[] = [];
  let spent = 0; let cost = 0; let refund = 0;
  for (const key of characterAttributes) {
    const value = build.points[key]; const integer = Number.isInteger(value);
    if (!integer || value < 0 || value > 24) errors.push('各项初始属性必须为 0～24 的整数');
    spent += value;
  }
  const unique = new Set(build.talents);
  if (unique.size !== build.talents.length) errors.push('不能重复选择同一天赋');
  for (const id of unique) {
    const talent = characterTalents.find(item => item.id === id);
    if (!talent) { errors.push('包含未知天赋'); continue; }
    const conflict = talent.opposite ? unique.has(talent.opposite) : false;
    if (conflict) errors.push(`「${talent.name}」与互斥天赋不能同时选择`);
    if (talent.cost > 0) cost += talent.cost;
    else if (id === 'shallow' && !usesMagic) errors.push('当前构筑不能证明浅池的实际代价，不能选取该弱点');
    else refund -= talent.cost;
  }
  if (refund > 4) errors.push('弱点最多返还 4 点预算');
  const remaining = 20 + refund - spent - cost;
  if (remaining < 0) errors.push('角色预算超支');
  if (remaining > 0) errors.push('请分配完剩余预算');
  const name = build.name.trim();
  if (name.length < 1 || name.length > 20) errors.push('角色名称需要 1～20 个字符');
  if (build.description.length > 120) errors.push('角色描述不能超过 120 个字符');
  return { spent, cost, refund, remaining, errors, valid: errors.length === 0 };
}

export function calculateCharacterStats(build: Pick<CharacterBuild, 'points' | 'talents'>): CharacterStats {
  const p = build.points;
  const stats: CharacterStats = { maxHp: 200 + p.vitality * 10, maxMp: 100 + p.spirit * 5, physicalAttack: 20 + p.power * 2, magicalAttack: 20 + p.magic * 2, physicalDefense: p.vitality, magicalDefense: p.spirit, movementSpeed: 3 * (1 + p.movement * 0.005), attackSpeed: 1 + p.haste * 0.01, castingSpeed: 1 + p.haste * 0.01, luck: p.luck };
  const unique = new Set(build.talents);
  for (const talent of characterTalents) {
    if (!unique.has(talent.id)) continue;
    const keys: (keyof CharacterStats)[] = ['maxHp', 'maxMp', 'physicalAttack', 'magicalAttack', 'physicalDefense', 'magicalDefense', 'movementSpeed', 'attackSpeed', 'castingSpeed', 'luck'];
    for (const key of keys) stats[key] += talent.modifiers[key] ?? 0;
  }
  return stats;
}
