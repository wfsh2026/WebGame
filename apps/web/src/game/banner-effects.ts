import Phaser from 'phaser';
import { bannerKinds } from '@web-game-world/simulation';
import type { Effect, Simulation } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import atlas from '../../../../content/packs/forest-survival/assets/battle-banners.webp';
interface Paint { frame: number; x: number; y: number; size: number; alpha: number; depth: number; angle?: number; originX?: number; originY?: number }
export function preloadBannerArt(scene: Phaser.Scene): void { scene.load.image('battle-banners', atlas); }
export function prepareBannerFrames(scene: Phaser.Scene): void {
  const texture = scene.textures.get('battle-banners'); const source = texture.getSourceImage();
  for (let index = 0; index < 20; index += 1) {
    if (texture.has(index)) continue;
    const row = Math.floor(index / 4); const x = Math.floor(index % 4 * source.width / 4); const y = Math.floor(row * source.height / 5);
    const width = Math.floor(source.width / 4); const height = Math.floor(source.height / 5);
    texture.add(index, 0, x, y, width, height);
  }
}
export class BannerEffects {
  private sprites: Phaser.GameObjects.Image[] = [];
  private used = 0;
  constructor(private scene: Phaser.Scene) { prepareBannerFrames(scene); }
  private draw(paint: Paint): void {
    if (this.used >= 420 || paint.alpha < .01) return;
    let sprite = this.sprites[this.used];
    if (!sprite) { sprite = this.scene.add.image(0, 0, 'battle-banners', paint.frame); this.sprites.push(sprite); }
    this.used += 1; sprite.setVisible(true); sprite.setTexture('battle-banners', paint.frame); sprite.setPosition(paint.x, paint.y);
    sprite.setOrigin(paint.originX ?? .5, paint.originY ?? .5); sprite.setDisplaySize(paint.size, paint.size); sprite.setAlpha(paint.alpha); sprite.setRotation(paint.angle ?? 0); sprite.setDepth(paint.depth);
  }
  private flag(effect: Effect, context: { sim: Simulation; viewport: BattleViewport; playerId: string }): void {
    const data = effect.banner; const row = bannerKinds.indexOf(effect.kind); if (!data || row < 0) return;
    const { viewport, sim } = context; const unit = viewport.unit;
    const x = viewport.ox + effect.x * unit; const y = viewport.oy + effect.y * unit; const margin = effect.radius * unit * 1.3;
    if (x < -margin || y < -margin || x > this.scene.scale.width + margin || y > this.scene.scale.height + margin) return;
    const age = (effect.duration ?? 8) - effect.ttl; const rawEnter = age / data.warmup; const enter = Math.min(1, rawEnter);
    const fade = Math.min(1, effect.ttl / Math.max(.5, data.tail));
    const mine = effect.owner === context.playerId; const local = sim.players.find(player => player.id === context.playerId);
    const dx = (local?.x ?? -999) - effect.x; const dy = (local?.y ?? -999) - effect.y;
    const inside = dx * dx + dy * dy <= effect.radius * effect.radius;
    const opacity = mine ? .55 : inside ? .35 : .18;
    // Circle source has padding; compensate so its crest perimeter matches the actual radius.
    const size = effect.radius * 2 * unit / .88;
    const ground = { frame: row * 4 + 2, x, y, size, alpha: opacity * enter * fade, depth: 1.5 }; this.draw(ground);
    if ((data.levels.area ?? 0) >= 10) { const edge = { ...ground, size: size * 1.15, alpha: opacity * .28 * enter * fade }; this.draw(edge); }
    const cycle = age % 6; const pulse = age < .65 ? age / .65 : (effect.level ?? 1) >= 20 && cycle < .7 ? cycle / .7 : -1;
    if (pulse >= 0) { const ring = { ...ground, size: size * (.25 + .75 * pulse), alpha: opacity * (1 - pulse) * fade, angle: .06 * pulse }; this.draw(ring); }
    const windTail = effect.kind === 'banner-wind' && (effect.level ?? 1) >= 20 && effect.ttl < data.tail;
    if (windTail) return;
    const absoluteY = Math.abs(effect.y); const depth = 2 + .5 * effect.y / (1 + absoluteY);
    // Two independently anchored cloth silhouettes retain the pole's ground contact.
    const crossfade = .5 + .5 * Math.sin(sim.clock * 5 + row);
    const width = unit * 1.55; const lift = (1 - enter) * unit * .4;
    const first = { frame: row * 4, x, y: y - lift, size: width, alpha: (1 - crossfade) * fade, depth, originX: .77, originY: .95 };
    const second = { ...first, frame: row * 4 + 1, alpha: crossfade * fade, originX: .3 };
    this.draw(first); this.draw(second);
  }
  render(sim: Simulation, viewport: BattleViewport, playerId: string): void {
    this.used = 0; const context = { sim, viewport, playerId };
    for (const mine of [true, false]) for (const effect of sim.effects) {
      if (effect.banner && effect.ttl > 0 && (effect.owner === playerId) === mine) this.flag(effect, context);
    }
    for (let index = this.used; index < this.sprites.length; index += 1) this.sprites[index].setVisible(false);
  }
}
