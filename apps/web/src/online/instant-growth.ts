import type { BuildStateData, PlayerView } from '@web-game-world/contracts';
import { trainBuildItem, applyCharacterGrowth, buildCatalog, characterGrowthRewards, equipmentRuntime, fitLoadout, makePlayer } from '@web-game-world/simulation';
import content from '../network/content';

export interface PendingGrowth { choiceId: number; index: number; confirmed: boolean }
export function predictGrowth(state: BuildStateData, view: PlayerView | undefined, request: PendingGrowth) {
  const choice = state.choices.find(item => item.id === request.choiceId);
  const option = choice?.options[request.index];
  if (!choice || choice.source !== 'level' || !option) return { state, player: view };
  const next = { ...state, characterRanks: { ...state.characterRanks }, items: state.items.map(item => ({ ...item })), choices: state.choices.filter(item => item.id !== choice.id), upgradeCredits: state.upgradeCredits - 1 };
  const catalog = buildCatalog(content, next.items);
  const item = catalog.find(entry => entry.id === option.itemId);
  const instance = next.items.find(entry => entry.id === option.itemId);
  const maximum = 20;
  let character = option.kind === 'character' ? option.itemId : '';
  if (option.kind === 'upgrade') {
    if (instance && item && (item.level ?? 1) < maximum) trainBuildItem(instance);
    else character = 'vitality';
  }
  let player = view;
  if (character) {
    const requested = characterGrowthRewards.find(reward => reward.id === character);
    const rank = state.characterRanks[character] ?? 0;
    const reward = requested && rank < requested.max ? requested : characterGrowthRewards[0];
    const currentRank = state.characterRanks[reward.id] ?? 0;
    if (currentRank < reward.max) next.characterRanks[reward.id] = currentRank + 1;
    if (view?.stats) {
      const identity = { id: view.id, name: view.name }; const model = makePlayer(identity, content);
      Object.assign(model, view); model.stats = { ...view.stats }; model.baseStats = { ...view.stats }; model.characterRanks = { ...state.characterRanks };
      for (const entry of characterGrowthRewards) {
        if (entry.stat === 'manaRecovery') continue;
        const applied = state.characterRanks[entry.id] ?? 0;
        model.baseStats[entry.stat] = entry.percent ? view.stats[entry.stat] / (1 + applied * entry.amount) : view.stats[entry.stat] - applied * entry.amount;
      }
      applyCharacterGrowth(model, character);
      player = { ...view, stats: model.stats, maxHp: model.maxHp, hp: model.hp, manaRecovery: model.manaRecovery };
    }
  }
  const upgraded = buildCatalog(content, next.items); next.loadout = fitLoadout(next.loadout, upgraded);
  if (player) {
    const equipment = equipmentRuntime(next.loadout, content, next.items);
    const capacity = equipment.heartItem?.capacity ?? 0; const energy = Math.min(player.energy, capacity);
    player = { ...player, buildItems: next.items, loadout: next.loadout, capacity, energy, buildRevision: (player.buildRevision ?? 0) + 1 };
  }
  return { state: next, player };
}
