import { abilityDemand } from './equipment';
import { buildCatalog, equippedIds } from './equipment';
import { characterGrowthRewards } from './character-growth';
import type { GrowthOption } from './build-growth';
import type { Player, Simulation } from './index';

function pick(sim: Simulation, entries: { option: GrowthOption; weight: number }[]): GrowthOption | undefined {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = sim.random() * total;
  for (const entry of entries) { roll -= entry.weight; if (roll < 0) return entry.option; }
  return entries.at(-1)?.option;
}
function optionsFor(sim: Simulation, player: Player): GrowthOption[] {
  const catalog = buildCatalog(sim.config, player.buildItems); const equipped = equippedIds(player.loadout);
  const eligible = catalog.filter(item => equipped.includes(item.id) && (item.level ?? 1) < 20);
  const runtime = player.equipment; const heart = runtime.heartItem;
  let demand = 0;
  for (const branch of runtime.branches) {
    const speed = branch.item.kind === 'weapon' ? player.stats.attackSpeed : player.stats.castingSpeed;
    demand += abilityDemand(branch, speed);
  }
  const shortage = heart ? demand > heart.recovery / heart.interval : false;
  const upgrades = eligible.map(item => {
    const level = item.level ?? 1;
    const milestone = level === 4 || level === 9 || level === 14 || level === 19;
    const supply = shortage && (item.kind === 'heart' || item.effect === 'economy');
    const option: GrowthOption = { kind: 'upgrade', itemId: item.id, level: level + 1 };
    return { option, weight: 2 + (milestone ? 2 : 0) + (supply ? 3 : 0) };
  });
  const perks = characterGrowthRewards.filter(reward => {
    if ((player.characterRanks[reward.id] ?? 0) >= reward.max) return false;
    if (reward.requires === 'heart') return Boolean(heart);
    return !reward.requires || runtime.branches.some(branch => branch.item.kind === reward.requires);
  }).map(reward => {
    const option: GrowthOption = { kind: 'character', itemId: reward.id, level: 1 };
    const manaShortage = heart && heart.manaCost / heart.interval > player.manaRecovery;
    return { option, weight: reward.id === 'mana' && manaShortage ? 5 : 2 };
  });
  const options: GrowthOption[] = [];
  const main = upgrades.filter(entry => catalog.find(item => item.id === entry.option.itemId)?.kind !== 'support');
  const firstPool = main.length ? main : upgrades.length ? upgrades : perks;
  const first = pick(sim, firstPool); if (first) options.push(first);
  const unusedPerks = perks.filter(entry => !options.some(option => option.itemId === entry.option.itemId));
  const second = pick(sim, unusedPerks); if (second) options.push(second);
  const remaining = [...upgrades, ...perks].filter(entry => !options.some(option => option.itemId === entry.option.itemId));
  const third = pick(sim, remaining); if (third) options.push(third);
  return options;
}
export function prepareLevelChoices(sim: Simulation, player: Player): void {
  const pending = player.choices.filter(choice => choice.source === 'level').length;
  for (let index = pending; index < player.upgradeCredits; index += 1) {
    const options = optionsFor(sim, player);
    const earnedLevel = player.level - player.upgradeCredits + index + 1;
    player.choiceSequence += 1;
    player.choices.push({ id: player.choiceSequence, earnedLevel, source: 'level', options });
  }
}
