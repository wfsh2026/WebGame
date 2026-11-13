import type { CharacterStats } from './characters';
import type { Player } from './index';

export interface CharacterGrowthReward { id: string; name: string; description: string; stat: keyof CharacterStats | 'manaRecovery'; amount: number; percent: boolean; max: number; requires?: 'weapon' | 'skill' | 'heart' }
export const characterGrowthRewards: CharacterGrowthReward[] = [
  { id: 'vitality', name: '强健体魄', description: '最大生命 +10%', stat: 'maxHp', amount: .1, percent: true, max: 100 },
  { id: 'physical', name: '锋芒毕露', description: '物理攻击 +8%', stat: 'physicalAttack', amount: .08, percent: true, max: 20, requires: 'weapon' },
  { id: 'magical', name: '术法精进', description: '魔法攻击 +8%', stat: 'magicalAttack', amount: .08, percent: true, max: 20, requires: 'skill' },
  { id: 'armor', name: '坚韧守护', description: '物理防御 +5', stat: 'physicalDefense', amount: 5, percent: false, max: 20 },
  { id: 'ward', name: '灵能护体', description: '魔法防御 +5', stat: 'magicalDefense', amount: 5, percent: false, max: 20 },
  { id: 'mana', name: '凝神回元', description: '每秒魔法恢复 +1', stat: 'manaRecovery', amount: 1, percent: false, max: 10, requires: 'heart' },
  { id: 'movement', name: '轻身步法', description: '移动速度 +3%', stat: 'movementSpeed', amount: .03, percent: true, max: 10 },
  { id: 'attack-speed', name: '疾风身手', description: '攻击速度 +5%', stat: 'attackSpeed', amount: .05, percent: true, max: 10, requires: 'weapon' },
  { id: 'casting-speed', name: '灵巧施法', description: '施法速度 +5%', stat: 'castingSpeed', amount: .05, percent: true, max: 10, requires: 'skill' }
];
export function applyCharacterGrowth(player: Player, requested: string): void {
  const reward = characterGrowthRewards.find(item => item.id === requested) ?? characterGrowthRewards[0];
  const rank = player.characterRanks[reward.id] ?? 0;
  if (rank >= reward.max) { if (reward.id !== 'vitality') applyCharacterGrowth(player, 'vitality'); return; }
  player.characterRanks[reward.id] = rank + 1;
  if (reward.stat === 'manaRecovery') { player.manaRecovery += reward.amount; return; }
  const base = player.baseStats[reward.stat];
  const gain = reward.percent ? base * reward.amount : reward.amount;
  player.stats[reward.stat] += gain;
  if (reward.stat === 'maxHp') {
    player.maxHp = player.stats.maxHp;
    if (player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + gain);
  }
}
