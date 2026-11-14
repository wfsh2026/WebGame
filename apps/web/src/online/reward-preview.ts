import type { BuildStateData, PlayerView } from '@web-game-world/contracts';
import { abilityDemand, abilityGrowthSummary, abilityUnlock, bannerAttackPattern, bannerConfig, buildCatalog, characterGrowthRewards, equipmentRuntime, equippedIds, heartCapacity, heartCostMultiplier, heartSupply, homingStats, isBanner, itemAtLevel, itemExperienceNeeded, supportProgress, trainBuildItem } from '@web-game-world/simulation';
import type { EquipmentItem } from '@web-game-world/simulation';
import { displayNumber as number, equipmentDescription } from '../hud/display-number';
import content from '../network/content';
import { predictGrowth } from './instant-growth';

type Option = BuildStateData['choices'][number]['options'][number];
interface Context { state: BuildStateData; player?: PlayerView; choice: BuildStateData['choices'][number]; targetId?: string }
interface Row { label: string; before?: string; after: string; tone?: 'benefit' | 'cost' }
interface Preview { title: string; level: string; headline: string; rows: Row[]; action: string; item?: EquipmentItem; status?: string; note?: string; details?: string; disabled?: boolean }

function comparison(label: string, before: number | undefined, after: number): Row {
  const previous = before === undefined ? undefined : number(before);
  const next = number(after);
  const row: Row = { label, before: previous, after: next };
  if (before !== undefined && previous !== next) {
    const lowerBetter = /消耗|需求|间隔|耗能/.test(label);
    const improved = lowerBetter ? after < before : after > before;
    row.tone = improved ? 'benefit' : 'cost';
  }
  return row;
}

function power(state: BuildStateData, player?: PlayerView) {
  const runtime = equipmentRuntime(state.loadout, content, state.items);
  const supply = heartSupply(runtime.heartItem, player?.energyRecoveryBonus);
  let demand = 0;
  for (const branch of runtime.branches) {
    const speed = branch.item.skillType === 'melee' ? player?.stats?.attackSpeed ?? 1 : player?.stats?.castingSpeed ?? 1;
    demand += abilityDemand(branch, speed);
  }
  return { supply, demand };
}

function characterPreview(option: Option, context: Context): Preview {
  const requested = characterGrowthRewards.find(reward => reward.id === option.itemId);
  const rank = context.state.characterRanks[option.itemId] ?? 0;
  const reward = requested && rank < requested.max ? requested : characterGrowthRewards[0];
  const currentRank = context.state.characterRanks[reward.id] ?? 0;
  const view: Preview = { title: reward.name, level: '角色成长', headline: reward.description, rows: [], action: '选择成长' };
  if (currentRank >= reward.max) { view.headline = '已达成长上限'; view.disabled = true; return view; }
  const replacement: Option = { kind: 'character', itemId: reward.id, level: 1 };
  const choice: Context['choice'] = { ...context.choice, source: 'level', options: [replacement] };
  const state = { ...context.state, choices: [choice] };
  const request = { choiceId: choice.id, index: 0, confirmed: false };
  const prediction = predictGrowth(state, context.player, request);
  const before = context.player; const after = prediction.player;
  if (!before?.stats || !after?.stats) return view;
  const labels = { maxHp: '生命上限', physicalAttack: '物理攻击', magicalAttack: '魔法攻击', physicalDefense: '物理防御', magicalDefense: '魔法防御', movementSpeed: '移动速度', attackSpeed: '近战速度', castingSpeed: '远程速度', energyCapacityBonus: '灵力容量加成', energyRecoveryBonus: '每秒灵力恢复', luck: '幸运' };
  const oldValue = reward.stat === 'energyRecoveryBonus' ? before.energyRecoveryBonus ?? 0 : before.stats[reward.stat];
  const nextValue = reward.stat === 'energyRecoveryBonus' ? after.energyRecoveryBonus ?? 0 : after.stats[reward.stat];
  const gain = number(nextValue - oldValue);
  const label = labels[reward.stat];
  view.headline = `${label} +${gain}`;
  const row = comparison(label, oldValue, nextValue); view.rows.push(row);
  if (reward.stat === 'maxHp' && before.hp > 0) { const hp = comparison('当前生命', before.hp, after.hp); view.rows.push(hp); }
  if (reward.stat === 'maxHp' && before.hp <= 0) view.note = '灵魂状态 · 等待复活';
  if (reward.stat === 'energyCapacityBonus') { const capacity = comparison('灵力上限', before.capacity, after.capacity); view.rows.push(capacity); }
  if (reward.stat === 'attackSpeed' || reward.stat === 'castingSpeed' || reward.stat === 'energyRecoveryBonus') {
    const previous = power(context.state, before); const next = power(prediction.state, after);
    const supply = comparison('基础供给 /秒', previous.supply, next.supply);
    const demand = comparison('满速需求 /秒', previous.demand, next.demand);
    view.rows.push(supply, demand);
    if (next.demand > next.supply) view.note = '满速需求超过供给';
  }
  return view;
}

function supportFacts(item: EquipmentItem): Record<string, number> {
  const progress = supportProgress(item.level ?? 1);
  const facts: Record<string, number> = { '伤害／增益倍率': item.damageMultiplier, '耗能倍率': item.costMultiplier };
  if (item.effect === 'haste') facts['间隔倍率'] = .9 - .15 * progress;
  if (item.effect === 'area') facts['范围倍率'] = 1.15 + .2 * progress;
  if (item.effect === 'concentrate') facts['范围倍率'] = .75 - .05 * progress;
  if (item.effect === 'duration') facts['战旗持续倍率'] = 1.3 + .3 * progress;
  if (item.effect === 'linger') facts['离阵额外保留 /秒'] = 1.5 + 1.5 * progress;
  if (item.effect === 'knockback') facts['追加击退 /米'] = .25 + .25 * progress;
  if (item.effect === 'resonance') facts['共鸣增幅 %'] = 15 + 15 * progress;
  if (item.effect === 'homing') { const settings = homingStats(item.level ?? 1); facts['索敌半径 /米'] = settings.range; facts['转向 /度每秒'] = settings.turnDegrees; }
  if (item.projectiles !== undefined) facts['投射物'] = item.projectiles;
  return facts;
}

function baseBanner(item: EquipmentItem) {
  const branch = { item, supportIds: [], costMultiplier: 1, damageMultiplier: 1, projectiles: 1, intervalMultiplier: 1, areaMultiplier: 1, knockback: 0, supportLevels: {}, accents: [], accentLevels: {}, resonance: 0, fork: 0, unleash: 0, echo: 0, spread: 0 };
  return bannerConfig(branch);
}

function itemRows(item: EquipmentItem, previous?: EquipmentItem): Row[] {
  if (item.kind === 'heart') {
    const supply = heartSupply(item); const beforeSupply = previous ? heartSupply(previous) : undefined;
    const discount = heartCostMultiplier(item); const beforeDiscount = previous ? heartCostMultiplier(previous) : undefined;
    return [comparison('基础供给 /秒', beforeSupply, supply), comparison('基础容量', previous?.capacity, item.capacity), comparison('能力槽', previous?.slots, item.slots), comparison('耗能倍率', beforeDiscount, discount)];
  }
  if (item.kind === 'skill') {
    if (isBanner(item.effect)) {
      const banner = baseBanner(item); const before = previous ? baseBanner(previous) : undefined;
      const pattern = bannerAttackPattern(item.effect ?? '');
      const coefficient = (item.coefficient ?? 0) * 100;
      const previousCoefficient = previous ? (previous.coefficient ?? 0) * 100 : undefined;
      return [comparison('每击魔攻系数 %', previousCoefficient, coefficient), comparison('旗阵攻击周期 /秒', previous ? pattern.interval : undefined, pattern.interval), comparison('基础旗阵强度', before?.strength, banner.strength), comparison('基础半径 /米', before?.radius, banner.radius), comparison('基础持续 /秒', before?.duration, banner.duration), comparison('基础消耗', previous?.cost, item.cost), comparison('辅助槽', previous?.supportSlots, item.supportSlots)];
    }
    const coefficient = (item.coefficient ?? 0) * 100;
    const beforeCoefficient = previous ? (previous.coefficient ?? 0) * 100 : undefined;
    return [comparison('伤害系数 %', beforeCoefficient, coefficient), comparison('基础间隔 /秒', previous?.interval, item.interval), comparison('基础消耗', previous?.cost, item.cost), comparison('辅助槽', previous?.supportSlots, item.supportSlots)];
  }
  const before: Record<string, number> = previous ? supportFacts(previous) : {};
  const after = supportFacts(item);
  const entries = Object.entries(after);
  return entries.map(([label, value]) => comparison(label, before[label], value));
}

export function rewardPreview(option: Option, context: Context): Preview {
  if (option.kind === 'character') return characterPreview(option, context);
  const catalog = buildCatalog(content, context.state.items);
  const targetId = option.kind === 'refine' ? context.targetId : option.itemId;
  const current = catalog.find(item => item.id === targetId);
  if (option.kind === 'refine' && !current) return { title: option.itemId === 'heart' ? '心法修习' : '技能精修', level: '指定强化', headline: '暂无可强化目标', rows: [], action: '请先装配目标', disabled: true };
  if (option.kind === 'upgrade' && (!current || (current.level ?? 1) >= 20)) {
    const fallback: Option = { kind: 'character', itemId: 'vitality', level: 1 };
    const result = characterPreview(fallback, context); result.note = '原目标不可提升，转为体魄成长';
    const equipped = equippedIds(context.state.loadout);
    result.disabled = result.disabled || !equipped.includes(option.itemId);
    if (!equipped.includes(option.itemId)) result.note = '请先装配原强化目标，或刷新奖励';
    return result;
  }
  if (option.kind === 'item') {
    const definition = content.equipmentDefinitions.find(item => item.id === option.itemId);
    if (!definition) return { title: '物品暂不可用', level: '', headline: '请刷新奖励', rows: [], action: '暂不可领取', disabled: true };
    const item = itemAtLevel(definition, option.level);
    const same = catalog.filter(entry => entry.definitionId === definition.id);
    const best = same.reduce<EquipmentItem | undefined>((highest, entry) => !highest || (entry.level ?? 1) > (highest.level ?? 1) ? entry : highest, undefined);
    const facts = itemRows(item, best);
    const rows = facts.filter(row => row.before !== row.after && (row.before !== undefined || !row.label.endsWith('倍率') || row.after !== '1'));
    const level = best ? `Lv.${option.level} · 对比同名最高 Lv.${best.level}` : `物品 Lv.${option.level}`;
    const description = equipmentDescription(item); const growth = abilityGrowthSummary(item);
    const details = `${description}${growth ? `；${growth}` : ''}`;
    const sentences = (item.description ?? '').split(/[。；]/);
    const headline = item.kind === 'heart' ? `获得 ${item.slots} 槽心法` : sentences[0] || '获得新能力';
    return { item, title: item.name, level, headline, rows, note: '领取到储备 · 装配且满足激活条件后生效', action: '领取物品', details };
  }
  const instances = context.state.items.map(item => ({ ...item }));
  const instance = instances.find(item => item.id === targetId);
  if (!current || !instance) return { title: '目标已变化', level: '', headline: '请刷新奖励', rows: [], action: '暂不可强化', disabled: true };
  trainBuildItem(instance);
  const nextCatalog = buildCatalog(content, instances);
  const next = nextCatalog.find(item => item.id === current.id) ?? current;
  const equipped = equippedIds(context.state.loadout);
  const active = equipped.includes(current.id);
  const runtime = equipmentRuntime(context.state.loadout, content, context.state.items);
  const activated = runtime.heartItem?.id === current.id || runtime.branches.some(branch => branch.item.id === current.id || branch.supportIds.includes(current.id));
  const level = current.level ?? 1;
  const nextLevel = next.level ?? 1;
  const status = active ? activated ? '已激活' : '已装配 · 未激活' : '未装备';
  const view: Preview = { item: current, title: current.name, level: `Lv.${level} → ${nextLevel}`, headline: '', rows: [], action: '选择升级', status, disabled: !active };
  if (active && !activated) view.note = '当前尚未激活，强化进度保留';
  if (!active) view.note = '请先装配目标，或刷新奖励';
  if (nextLevel === level) {
    const required = itemExperienceNeeded(level);
    const experience = comparison('修习进度', current.experience ?? 0, next.experience ?? 0);
    const missing = number(required - (next.experience ?? 0));
    view.level = `Lv.${level}`; view.headline = '修习经验 +100'; view.rows = [experience, { label: '距离升级', after: `${missing} 经验` }]; view.action = '选择修习';
    return view;
  }
  const rows = itemRows(next, current);
  view.rows = rows.filter(row => row.before !== row.after);
  if (current.kind === 'heart') {
    const beforeSlots = current.slots; const afterSlots = next.slots;
    const slots = comparison('激活能力槽', beforeSlots, afterSlots);
    view.rows = view.rows.filter(row => row.label !== '能力槽');
    if (afterSlots > beforeSlots) view.rows.unshift(slots);
    const supply = heartSupply(current, context.player?.energyRecoveryBonus); const nextSupply = heartSupply(next, context.player?.energyRecoveryBonus);
    const gain = number(nextSupply - supply);
    view.headline = afterSlots > beforeSlots ? `新增能力槽 +${afterSlots - beforeSlots}` : `每秒供能 +${gain}`;
    if (afterSlots === beforeSlots && nextSupply === supply) {
      const capacityGain = number(next.capacity - current.capacity);
      view.headline = `灵力上限 +${capacityGain}`;
    }
    if (context.player) {
      const beforeCapacity = heartCapacity(current, context.player.stats?.energyCapacityBonus); const afterCapacity = heartCapacity(next, context.player.stats?.energyCapacityBonus);
      view.rows = view.rows.filter(row => row.label !== '基础容量');
      if (beforeCapacity !== afterCapacity) { const capacityRow = comparison('灵力上限', beforeCapacity, afterCapacity); view.rows.push(capacityRow); }
    }
  } else if (current.kind === 'skill') {
    const beforeSlots = current.supportSlots; const afterSlots = next.supportSlots;
    view.rows = view.rows.filter(row => row.label !== '辅助槽');
    if (afterSlots > beforeSlots) { const slots = comparison('激活辅助槽', beforeSlots, afterSlots); view.rows.unshift(slots); }
    const coefficient = current.coefficient ?? 0; const nextCoefficient = next.coefficient ?? 0;
    const gain = coefficient ? (nextCoefficient / coefficient - 1) * 100 : 0; const gainText = number(gain);
    view.headline = afterSlots > beforeSlots ? `新增辅助槽 +${afterSlots - beforeSlots}` : `伤害系数 +${gainText}%`;
    if (isBanner(current.effect) && afterSlots === beforeSlots) {
      const beforeBanner = baseBanner(current); const afterBanner = baseBanner(next);
      const strengthGain = number((afterBanner.strength / beforeBanner.strength - 1) * 100);
      view.headline = `每击伤害 +${gainText}% · 旗阵强度 +${strengthGain}%`;
    }
  } else view.headline = '强化所属技能';
  const unlock = abilityUnlock(next, nextLevel);
  if (unlock) { view.note = active ? unlock : view.note; view.details = abilityGrowthSummary(next); }
  if (active) {
    const nextState = { ...context.state, items: instances };
    const previousPower = power(context.state, context.player); const nextPower = power(nextState, context.player);
    if (previousPower.demand !== nextPower.demand) { const demand = comparison('满速需求 /秒', previousPower.demand, nextPower.demand); view.rows.push(demand); }
    if (nextPower.demand > nextPower.supply) { const shortage = number(nextPower.demand - nextPower.supply); view.note = `${view.note ? `${view.note} · ` : ''}满速缺能 ${shortage}/秒`; }
  }
  return view;
}
