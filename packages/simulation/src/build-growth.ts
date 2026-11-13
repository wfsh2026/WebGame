import { abilityProgress } from './combat-rhythm';
import { abilityUnlock } from './ability-growth';
import { applyCharacterGrowth } from './character-growth';
import { prepareLevelChoices } from './level-rewards';
import { updateResonance } from './resonance';
import { trainBuildItem, buildCatalog, equipmentCatalog, equipmentRuntime, equippedIds, fitLoadout, supportCompatible } from './equipment';
import type { BuildItem, EquipmentLoadout, EquipmentItem } from './equipment';
import type { Player, Simulation, SimConfig } from './index';

export interface GrowthOption { kind: 'upgrade' | 'item' | 'refine' | 'character'; itemId: string; level: number }
export interface GrowthChoice { earnedLevel?: number; wave?: number; keyWave?: boolean; id: number; source: 'level' | 'wave' | 'link'; options: GrowthOption[] }
export function experienceNeeded(level: number): number { return 16 + (level - 1) * 8; }
export function refreshBuild(player: Player, config: SimConfig): void {
  const catalog = buildCatalog(config, player.buildItems);
  player.loadout = fitLoadout(player.loadout, catalog);
  const previous = player.equipment;
  player.equipment = equipmentRuntime(player.loadout, config, player.buildItems);
  const oldHeart = previous.heartItem?.id; const newHeart = player.equipment.heartItem?.id;
  for (const branch of player.equipment.branches) {
    const old = previous.branches.find(entry => entry.item.id === branch.item.id);
    const signature = JSON.stringify([branch.supportIds, branch.supportLevels]); const oldSignature = old ? JSON.stringify([old.supportIds, old.supportLevels]) : '';
    if (old && signature === oldSignature && oldHeart === newHeart) continue;
    let state = player.abilityStates.find(entry => entry.itemId === branch.item.id);
    if (!state) { state = { itemId: branch.item.id, remaining: branch.item.interval, count: 0, state: '计时中' }; player.abilityStates.push(state); }
    state.progress = undefined; const progress = abilityProgress(state); progress.origin = state.count;
    state.remaining = Math.max(state.remaining, branch.item.interval * branch.intervalMultiplier);
    player.resonance = undefined;
  }
  const equipped = player.equipment.branches.map(branch => branch.item.id);
  for (const state of player.abilityStates) if (!equipped.includes(state.itemId)) { state.progress = undefined; const progress = abilityProgress(state); progress.origin = state.count; }
  if (oldHeart !== newHeart) player.heartProgress = undefined;
  player.capacity = player.equipment.heartItem?.capacity ?? 0;
  player.energy = Math.min(player.energy, player.capacity);
  // Keep timers on unequipped item instances so swapping cannot reset attacks.
  const interval = player.equipment.heartItem?.interval ?? 1;
  player.heartWait = Math.max(player.heartWait, interval);
  updateResonance(player, 0);
  grantCompanionChoice(player, config);
  player.buildRevision += 1;
}
function grantCompanionChoice(player: Player, config: SimConfig): void {
  const slots = player.equipment.heartItem?.slots ?? 1;
  player.companionMilestones ??= [];
  for (let milestone = 2; milestone <= slots; milestone += 1) {
  if (player.companionMilestones.includes(milestone)) continue;
  const branches = player.equipment.branches;
  const hasWeapon = branches.some(branch => branch.item.kind === 'weapon');
  const hasSkill = branches.some(branch => branch.item.kind === 'skill');
  const desired = hasWeapon && !hasSkill ? 'skill' : hasSkill && !hasWeapon ? 'weapon' : '';
  const catalog = equipmentCatalog(config);
  const preferred = desired === 'skill' ? 'thunder-seal' : 'thunder-staff';
  const available = catalog.filter(item => desired ? item.kind === desired : item.kind === 'weapon' || item.kind === 'skill');
  available.sort((a, b) => Number(b.effect === preferred) - Number(a.effect === preferred));
  const candidates = available.slice(0, 3);
  const options: GrowthOption[] = candidates.map(item => ({ kind: 'item', itemId: item.id, level: 1 }));
  if (!options.length) return;
  player.companionMilestones.push(milestone); player.choiceSequence += 1;
  player.choices.push({ id: player.choiceSequence, source: 'link', options });
  }
}
export function initializeBuild(player: Player, data: { ids: string[]; items?: BuildItem[]; config: SimConfig }): void {
  const unique = new Set(data.ids);
  player.buildItems = data.items ? data.items.map(item => ({ ...item, bonus: 0, experience: 0 })) : [...unique].map(id => ({ id, definitionId: id, level: 1, bonus: 0 }));
  refreshBuild(player, data.config);
  player.energy = player.capacity;
  for (const state of player.abilityStates) state.remaining = 0;
}
function sample<T>(sim: Simulation, items: T[]): T[] {
  const remaining = [...items]; const result: T[] = [];
  while (remaining.length && result.length < 3) {
    const random = sim.random(); const index = Math.floor(random * remaining.length);
    const picked = remaining.splice(index, 1); result.push(picked[0]);
  }
  return result;
}
function itemOptions(sim: Simulation): GrowthOption[] {
  const catalog = equipmentCatalog(sim.config); const chosen = sample(sim, catalog);
  const tier = 1 + Math.floor((sim.round - 1) / 3);
  return chosen.map(item => ({ kind: 'item', itemId: item.id, level: Math.min(20, tier) }));
}
export function prepareChoices(sim: Simulation, player: Player): void {
  prepareLevelChoices(sim, player);
}
export function mergeBuildItems(player: Player, config: SimConfig): void {
  const merged = mergeReserve(player, { items: player.buildItems, config });
  if (!merged.notices.length) return;
  player.buildItems = merged.items;
  player.fusionNotices ??= []; player.fusionNotices.push(...merged.notices);
  const retained = new Set(merged.items.map(item => item.id));
  player.abilityStates = player.abilityStates.filter(state => retained.has(state.itemId));
  player.buildRevision += 1;
}
function mergeReserve(player: Player, data: { items: BuildItem[]; config: SimConfig }) {
  let items = data.items.map(item => ({ ...item })); const notices: string[] = [];
  const occupied = equippedIds(player.loadout);
  const protectedIds = player.choices.flatMap(choice => choice.options.filter(option => option.kind === 'upgrade').map(option => option.itemId));
  const definitions = equipmentCatalog(data.config);
  for (const definition of definitions) {
    const maximum = 20;
    for (let level = 1; level < maximum; level += 1) {
      let group = items.filter(item => item.definitionId === definition.id && item.level === level && item.bonus === 0 && !item.experience && item.id.startsWith(`${player.id}:item:`) && !occupied.includes(item.id) && !protectedIds.includes(item.id));
      let count = 0;
      while (group.length >= 3) {
        const batch = group.slice(-3); const survivor = batch[2];
        const consumed = new Set([batch[0].id, batch[1].id]);
        items = items.filter(item => !consumed.has(item.id)); survivor.level += 1; count += 1;
        group = group.slice(0, -3);
      }
      if (count) notices.push(`${definition.name}：Lv.${level} ×${count * 3} → Lv.${level + 1} ×${count}`);
    }
  }
  return { items, notices };
}
export function grantBuildItem(player: Player, option: GrowthOption, config: SimConfig): boolean {
  const sequence = player.choiceSequence + 1; const id = `${player.id}:item:${sequence}`;
  const item = { id, definitionId: option.itemId, level: option.level, bonus: 0 };
  const items = [...player.buildItems, item]; const data = { items, config };
  const merged = mergeReserve(player, data);
  if (merged.items.length > 120) return false;
  player.choiceSequence = sequence; player.buildItems = merged.items;
  if (merged.notices.length) {
    player.fusionNotices ??= []; player.fusionNotices.push(...merged.notices);
    const retained = new Set(merged.items.map(entry => entry.id));
    player.abilityStates = player.abilityStates.filter(state => retained.has(state.itemId));
  }
  player.buildRevision += 1;
  return true;
}
export function awardCombatGrowth(sim: Simulation, player: Player, kill: boolean): void {
  if (sim.presentationOnly) return;
  player.experience += kill ? 8 : 4;
  let threshold = experienceNeeded(player.level);
  while (player.experience >= threshold && player.level < 100) {
    player.experience -= threshold; player.level += 1; player.upgradeCredits += 1;
    threshold = experienceNeeded(player.level);
  }
  prepareChoices(sim, player); player.buildRevision += 1;
}
function waveOptions(sim: Simulation, player: Player): GrowthOption[] {
  const catalog = equipmentCatalog(sim.config);
  const current = buildCatalog(sim.config, player.buildItems);
  const equipped = equippedIds(player.loadout);
  const abilities = current.filter(item => equipped.includes(item.id) && (item.kind === 'weapon' || item.kind === 'skill'));
  const emptyAbility = player.loadout.slots.some(slot => !slot);
  const compatible = catalog.filter(item => item.kind === 'support' && abilities.some(ability => supportCompatible(item, ability)));
  const openBranches = player.loadout.slots.filter(slot => slot && slot.supports.some(id => !id));
  const gapGems = compatible.filter(gem => openBranches.some(slot => {
    const ability = current.find(item => item.id === slot?.itemId);
    if (!ability || !slot) return false;
    const already = slot.supports.some(id => current.find(item => item.id === id)?.definitionId === gem.id);
    return !already && supportCompatible(gem, ability);
  }));
  const abilityPool = catalog.filter(item => item.kind === 'weapon' || item.kind === 'skill');
  const gapPool = emptyAbility ? abilityPool : gapGems.length ? gapGems : compatible.length ? compatible : abilityPool;
  const keyWave = sim.round % 3 === 0;
  const tier = 1 + Math.floor((sim.round - 1) / 3);
  const options: GrowthOption[] = [];
  const used = new Set<string>();
  function addItem(pool: EquipmentItem[], bonus: number): void {
    const available = pool.filter(item => !used.has(item.id));
    const sampled = sample(sim, available); const item = sampled[0];
    if (!item) return;
    const level = Math.min(20, tier + bonus);
    options.push({ kind: 'item', itemId: item.id, level }); used.add(item.id);
  }
  addItem(gapPool, 0);
  const randomPool = keyWave ? catalog : catalog.filter(item => item.kind !== 'heart');
  addItem(randomPool, keyWave ? 1 : 0);
  if (keyWave) {
    const eligible = current.filter(item => (item.level ?? 1) < 20);
    const kinds = eligible.map(item => item.kind);
    const categories = [...new Set(kinds)];
    const sampled = sample(sim, categories); const category = sampled[0];
    if (category) options.push({ kind: 'refine', itemId: category, level: 1 });
  }
  if (options.length < 3) addItem(compatible, 0);
  if (options.length < 3) addItem(catalog, keyWave ? 1 : 0);
  return options;
}

export function awardWaveGrowth(sim: Simulation): void {
  if (sim.presentationOnly) return;
  for (const player of sim.players) {
    const options = waveOptions(sim, player);
    player.waveCredits += 1; player.choiceSequence += 1;
    const choice: GrowthChoice = { id: player.choiceSequence, source: 'wave', wave: sim.round, keyWave: sim.round % 3 === 0, options };
    player.choices.push(choice); player.buildRevision += 1;
  }
}
export function chooseGrowth(sim: Simulation, player: Player, request: { choiceId: number; index: number; targetId?: string }): string {
  const choice = player.choices.find(entry => entry.id === request.choiceId);
  const option = choice?.options[request.index];
  if (!choice || !option) return '该奖励已经处理，请选择当前奖励';
  const previousCatalog = buildCatalog(sim.config, player.buildItems);
  if (option.kind === 'character') applyCharacterGrowth(player, option.itemId);
  else if (option.kind === 'refine') {
    const catalog = buildCatalog(sim.config, player.buildItems);
    const eligible = catalog.filter(item => item.kind === option.itemId && (item.level ?? 1) < 20);
    if (!eligible.length) {
      const replacements = waveOptions(sim, player);
      const alternative = replacements.find(item => item.kind === 'item');
      if (alternative) {
        const tier = 1 + Math.floor(((choice.wave ?? 1) - 1) / 3);
        alternative.level = Math.min(alternative.level, tier);
        choice.options[request.index] = alternative; player.buildRevision += 1;
      }
      return '该类别已无可强化物品，奖励已替换，请重新选择';
    }
    const target = eligible.find(item => item.id === request.targetId);
    const instance = player.buildItems.find(item => item.id === target?.id);
    if (!target || !instance) return '请选择该类别中尚未满级的物品';
    trainBuildItem(instance);
  } else if (option.kind === 'upgrade') {
    const instance = player.buildItems.find(item => item.id === option.itemId);
    const catalog = buildCatalog(sim.config, player.buildItems);
    const current = catalog.find(item => item.id === option.itemId);
    const maximum = 20;
    if (!instance || !current || (current.level ?? 1) >= maximum) applyCharacterGrowth(player, 'vitality');
    else trainBuildItem(instance);
  } else if (!grantBuildItem(player, option, sim.config)) return '局内储备已满，请先整理储备';
  if (choice.source === 'level') player.upgradeCredits -= 1; else if (choice.source === 'wave') player.waveCredits -= 1;
  player.choices = player.choices.filter(entry => entry.id !== choice.id);
  mergeBuildItems(player, sim.config); refreshBuild(player, sim.config); prepareChoices(sim, player);
  const currentCatalog = buildCatalog(sim.config, player.buildItems);
  for (const item of currentCatalog) {
    const previous = previousCatalog.find(entry => entry.id === item.id);
    if (!previous || previous.level === item.level) continue;
    const unlocked = abilityUnlock(item, item.level ?? 1);
    if (unlocked) { player.growthNotices ??= []; player.growthNotices.push(`${item.name}已解锁：${unlocked}`); }
  }
  return '';
}
export function changeBuild(player: Player, data: { loadout: EquipmentLoadout; revision: number }, config: SimConfig): string {
  if (data.revision > player.buildRevision) return '构筑已更新，请重新操作';
  const catalog = buildCatalog(config, player.buildItems);
  const ids = equippedIds(data.loadout); const owned = new Set(player.buildItems.map(item => item.id));
  const unique = new Set(ids);
  if (unique.size !== ids.length || ids.some(id => !owned.has(id))) return '物品不存在或重复装配';
  const fitted = fitLoadout(data.loadout, catalog);
  // Explicitly return overflow and incompatible gems to reserve.
  player.loadout = fitted; mergeBuildItems(player, config); refreshBuild(player, config);
  return '';
}

export function discardBuildItem(player: Player, id: string): string {
  const equipped = equippedIds(player.loadout);
  if (equipped.includes(id)) return '请先卸下该物品';
  const pending = player.choices.some(choice => choice.options.some(option => option.kind === 'upgrade' && option.itemId === id));
  if (pending) return '请先处理该物品的待选升级奖励';
  const instance = player.buildItems.find(item => item.id === id);
  if (!instance) return '物品已不存在';
  player.buildItems = player.buildItems.filter(item => item.id !== id);
  player.buildRevision += 1;
  return '';
}
