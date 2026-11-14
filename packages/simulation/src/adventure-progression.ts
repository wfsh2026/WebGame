export const abilitySlotLevels = [1, 3, 8, 13, 18];
export const supportSlotLevels = [1, 5, 10, 15, 20];
export const activationSlotLevels = [1, 5, 10, 15, 20];
export const growthRefreshPrices = { level: 5, wave: 8 };

export function characterSlots(level: number) {
  const abilities = abilitySlotLevels.filter(required => level >= required).length;
  const supports = supportSlotLevels.filter(required => level >= required).length;
  return { abilities, supports };
}

export function characterUpgradePrice(level: number): number {
  return level >= 20 ? 0 : 50 + (level - 1) * 25;
}

export function activationSlots(level: number): number {
  const count = activationSlotLevels.filter(required => level >= required).length;
  return Math.max(1, count);
}
