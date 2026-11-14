import Phaser from 'phaser';
import type { Vec } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import atlasUrl from '../../../../content/packs/forest-survival/assets/runtime/monster-vfx.webp';
import atlasData from '../../../../content/packs/forest-survival/assets/runtime/monster-vfx.json';
import skillsUrl from '../../../../content/packs/forest-survival/assets/runtime/monster-skills.png';
import glowUrl from '../../../../content/packs/forest-survival/assets/runtime/monster-skills-glow.png';
import skillsData from '../../../../content/packs/forest-survival/assets/runtime/monster-skills.json';

export function preloadMonsterArt(scene: Phaser.Scene): void {
  scene.load.atlas('monster-vfx', atlasUrl, atlasData);
  scene.load.atlas('monster-skills', skillsUrl, skillsData); scene.load.atlas('monster-skills-glow', glowUrl, skillsData);
}
export interface MonsterAppearance { width: number; height?: number; angle?: number; alpha?: number; depth?: number; tint?: number; fill?: boolean; glow?: number; original?: boolean; additive?: boolean }
const skillDisplay: Record<string, { width: number; height: number }> = skillsData.meta.display;
export class MonsterArt {
  private sprites: Phaser.GameObjects.Image[] = [];
  private glows: Phaser.GameObjects.Image[] = [];
  private used = 0;
  private usedGlows = 0;
  private viewport: BattleViewport = { unit: 32, ox: 0, oy: 0 };
  constructor(private scene: Phaser.Scene) {}
  begin(viewport: BattleViewport): void { this.viewport = viewport; this.used = 0; this.usedGlows = 0; }
  place(frame: string, point: Vec, appearance: MonsterAppearance): void {
    if (appearance.width <= 0 || (appearance.height ?? appearance.width) <= 0 || (appearance.alpha ?? 1) <= .01) return;
    const { unit, ox, oy } = this.viewport;
    const display = appearance.original ? undefined : skillDisplay[frame];
    const width = appearance.width * unit * (display?.width ?? 1);
    const height = (appearance.height ?? appearance.width) * unit * (display?.height ?? 1);
    const x = ox + point.x * unit; const y = oy + point.y * unit; const margin = Math.max(width, height);
    if (x < -margin || y < -margin || x > this.scene.scale.width + margin || y > this.scene.scale.height + margin) return;
    const texture = display ? 'monster-skills' : 'monster-vfx';
    let sprite = this.sprites[this.used];
    if (!sprite) { sprite = this.scene.add.image(0, 0, texture, frame); this.sprites.push(sprite); }
    this.used += 1;
    sprite.setTexture(texture, frame); sprite.setPosition(x, y);
    sprite.setDisplaySize(width, height);
    sprite.setRotation(appearance.angle ?? 0); sprite.setAlpha(appearance.alpha ?? 1); sprite.setDepth(appearance.depth ?? 1.1);
    const blend = appearance.additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL; sprite.setBlendMode(blend);
    sprite.clearTint();
    if (appearance.tint !== undefined) {
      if (appearance.fill) sprite.setTintFill(appearance.tint); else sprite.setTint(appearance.tint);
    }
    sprite.setVisible(true);
    if (!display || !appearance.glow || this.usedGlows >= 128) return;
    let glow = this.glows[this.usedGlows];
    if (!glow) { glow = this.scene.add.image(0, 0, 'monster-skills-glow', frame); this.glows.push(glow); }
    this.usedGlows += 1;
    const alpha = (appearance.alpha ?? 1) * appearance.glow; const depth = (appearance.depth ?? 1.1) - .001;
    glow.setTexture('monster-skills-glow', frame); glow.setPosition(x, y); glow.setDisplaySize(width, height);
    glow.setRotation(appearance.angle ?? 0); glow.setAlpha(alpha); glow.setDepth(depth); glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.clearTint(); if (appearance.tint !== undefined) glow.setTint(appearance.tint); glow.setVisible(true);
  }
  end(): void {
    for (let index = this.used; index < this.sprites.length; index += 1) this.sprites[index].setVisible(false);
    for (let index = this.usedGlows; index < this.glows.length; index += 1) this.glows[index].setVisible(false);
  }
}
