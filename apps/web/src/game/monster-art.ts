import type Phaser from 'phaser';
import type { Vec } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import atlasUrl from '../../../../content/packs/forest-survival/assets/runtime/monster-vfx.webp';
import atlasData from '../../../../content/packs/forest-survival/assets/runtime/monster-vfx.json';

export function preloadMonsterArt(scene: Phaser.Scene): void { scene.load.atlas('monster-vfx', atlasUrl, atlasData); }
export interface MonsterAppearance { width: number; height?: number; angle?: number; alpha?: number; depth?: number; tint?: number }
export class MonsterArt {
  private sprites: Phaser.GameObjects.Image[] = [];
  private used = 0;
  private viewport: BattleViewport = { unit: 32, ox: 0, oy: 0 };
  constructor(private scene: Phaser.Scene) {}
  begin(viewport: BattleViewport): void { this.viewport = viewport; this.used = 0; }
  place(frame: string, point: Vec, appearance: MonsterAppearance): void {
    const { unit, ox, oy } = this.viewport;
    const x = ox + point.x * unit; const y = oy + point.y * unit; const margin = appearance.width * unit;
    if (x < -margin || y < -margin || x > this.scene.scale.width + margin || y > this.scene.scale.height + margin) return;
    let sprite = this.sprites[this.used];
    if (!sprite) { sprite = this.scene.add.image(0, 0, 'monster-vfx', frame); this.sprites.push(sprite); }
    this.used += 1;
    sprite.setTexture('monster-vfx', frame); sprite.setPosition(x, y);
    sprite.setDisplaySize(appearance.width * unit, (appearance.height ?? appearance.width) * unit);
    sprite.setRotation(appearance.angle ?? 0); sprite.setAlpha(appearance.alpha ?? 1); sprite.setDepth(appearance.depth ?? 1.1);
    if (appearance.tint) sprite.setTint(appearance.tint); else sprite.clearTint();
    sprite.setVisible(true);
  }
  end(): void { for (let index = this.used; index < this.sprites.length; index += 1) this.sprites[index].setVisible(false); }
}
