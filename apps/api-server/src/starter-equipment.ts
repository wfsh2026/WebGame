import { characterSlots, starterEquipmentIds } from '@web-game-world/simulation';
import type { BuildItem, EquipmentLoadout } from '@web-game-world/simulation';

// 账号固有的一级保底物品，不写入购买库存，也不随冒险永久消耗。
export function starterItems(): BuildItem[] {
  return starterEquipmentIds.map(definitionId => ({ id: `starter:${definitionId}`, definitionId, level: 1, bonus: 0 }));
}

export function starterLoadout(characterLevel: number): EquipmentLoadout {
  const [heart, ability, support] = starterItems();
  const capacity = characterSlots(characterLevel);
  const supports: (string | null)[] = [];
  for (let index = 0; index < capacity.supports; index += 1) supports.push(index === 0 ? support.id : null);
  const slots: EquipmentLoadout['slots'] = [];
  for (let index = 0; index < capacity.abilities; index += 1) slots.push(index === 0 ? { itemId: ability.id, supports } : null);
  return { heart: heart.id, slots };
}
