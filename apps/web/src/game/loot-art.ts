import Phaser from 'phaser';
import type { LootItemData } from '@web-game-world/contracts';
import inventoryAtlas from '../../../../content/packs/forest-survival/assets/runtime/loot-symbols.png';
import effectsAtlas from '../../../../content/packs/forest-survival/assets/runtime/loot-growth.webp';

export const lootColors = [0xf1f6ff, 0x68ed82, 0x4ba8ff, 0xc774ff, 0xffd05a] as const;
export const lootColorNames = ['白', '绿', '蓝', '紫', '金'] as const;
export function lootGrade(level: number): number { const grade = Math.floor((level - 1) / 4); const bounded = Math.min(4, grade); return Math.max(0, bounded); }
export function lootColor(level: number): number { const grade = lootGrade(level); return lootColors[grade]; }
export function lootColorCss(level: number): string { const color = lootColor(level); const hex = color.toString(16); return `#${hex.padStart(6, '0')}`; }
export function playerFrameGrade(level: number): number { return level >= 100 ? 6 : level >= 80 ? 5 : level >= 60 ? 4 : level >= 40 ? 3 : level >= 20 ? 2 : level >= 10 ? 1 : 0; }
export function lootFrame(item: Pick<LootItemData, 'category' | 'effect' | 'kind' | 'skillType'>): number {
  const consumables: Record<string, number> = { life: 0, mana: 1, energy: 2, haste: 13, shield: 14, focus: 15 };
  if (item.category === 'consumable') return consumables[item.effect] ?? 2;
  return item.kind === 'skill' ? item.skillType === 'melee' ? 8 : 4 : item.kind === 'heart' ? 3 : 12;
}
export function preloadLootArt(scene: Phaser.Scene): void { scene.load.image('loot-symbols', inventoryAtlas); scene.load.image('loot-growth', effectsAtlas); }
export function prepareLootArt(scene: Phaser.Scene): void {
  for (const key of ['loot-symbols', 'loot-growth']) {
    const texture = scene.textures.get(key); if (texture.has('0')) continue;
    const source = texture.getSourceImage(); const width = Math.floor(source.width / 4); const height = Math.floor(source.height / 4);
    for (let index = 0; index < 16; index += 1) { const row = Math.floor(index / 4); const x = index % 4 * width; const y = row * height; texture.add(index, 0, x, y, width, height); }
  }
}
