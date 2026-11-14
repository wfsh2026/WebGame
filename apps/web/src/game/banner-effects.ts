import Phaser from 'phaser';
import { bannerKinds } from '@web-game-world/simulation';
import type { Effect, Simulation } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import atlas from '../../../../content/packs/forest-survival/assets/battle-banners.webp';
import clothUrl from '../../../../content/packs/forest-survival/assets/runtime/banner-cloth-v2.webp';
import clothData from '../../../../content/packs/forest-survival/assets/runtime/banner-cloth-v2.json';
import effectsUrl from '../../../../content/packs/forest-survival/assets/runtime/banner-vfx-v2.webp';
import effectsData from '../../../../content/packs/forest-survival/assets/runtime/banner-vfx-v2.json';

interface Paint { texture: string; frame: string; x: number; y: number; width: number; height: number; alpha: number; depth: number; angle?: number; originX?: number; originY?: number; additive?: boolean }
interface RenderContext { sim: Simulation; viewport: BattleViewport; playerId: string }
export function preloadBannerArt(scene: Phaser.Scene): void {
  scene.load.image('battle-banners', atlas);
  scene.load.atlas('banner-cloth-v2', clothUrl, clothData);
  scene.load.atlas('banner-vfx-v2', effectsUrl, effectsData);
}
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
  private draw(paint: Paint, decoration = false): void {
    if (decoration && this.used >= 420 || paint.alpha < .01) return;
    const margin = Math.max(paint.width, paint.height);
    if (paint.x < -margin || paint.y < -margin || paint.x > this.scene.scale.width + margin || paint.y > this.scene.scale.height + margin) return;
    let sprite = this.sprites[this.used];
    if (!sprite) { sprite = this.scene.add.image(0, 0, paint.texture, paint.frame); this.sprites.push(sprite); }
    this.used += 1; sprite.setVisible(true); sprite.setTexture(paint.texture, paint.frame); sprite.setPosition(paint.x, paint.y);
    sprite.setOrigin(paint.originX ?? .5, paint.originY ?? .5); sprite.setDisplaySize(paint.width, paint.height); sprite.setAlpha(paint.alpha); sprite.setRotation(paint.angle ?? 0); sprite.setDepth(paint.depth);
    const blend = paint.additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL;
    sprite.setBlendMode(blend);
  }
  private flag(effect: Effect, context: RenderContext): void {
    const data = effect.banner; const row = bannerKinds.indexOf(effect.kind); if (!data || row < 0) return;
    const { viewport, sim } = context; const unit = viewport.unit;
    const x = viewport.ox + effect.x * unit; const y = viewport.oy + effect.y * unit; const margin = effect.radius * unit * 1.3;
    if (x < -margin || y < -margin || x > this.scene.scale.width + margin || y > this.scene.scale.height + margin) return;
    const age = (effect.duration ?? 8) - effect.ttl; const rawEnter = age / data.warmup; const enter = Math.min(1, rawEnter);
    const fade = Math.min(1, effect.ttl / Math.max(.5, data.tail));
    const mine = effect.owner === context.playerId; const local = sim.players.find(player => player.id === context.playerId);
    const dx = (local?.x ?? -999) - effect.x; const dy = (local?.y ?? -999) - effect.y;
    const inside = dx * dx + dy * dy <= effect.radius * effect.radius;
    const opacity = mine ? .38 : inside ? .28 : .16;
    const kind = effect.kind.slice(7);
    // Exported range artwork has a 224-pixel diameter inside its 256-pixel frame.
    const size = effect.radius * 2 * unit / .875;
    const breath = .94 + .06 * Math.sin(age * 3 + row);
    const ground = { texture: 'banner-vfx-v2', frame: `${kind}-edge`, x, y, width: size, height: size, alpha: opacity * enter * fade * breath, depth: 1.3, additive: true };
    this.draw(ground);
    if ((data.levels.area ?? 0) >= 10) {
      const edge = { ...ground, width: size * 1.15, height: size * 1.15, alpha: opacity * .35 * enter * fade };
      this.draw(edge);
    }
    const windTail = effect.kind === 'banner-wind' && (effect.level ?? 1) >= 20 && effect.ttl < data.tail;
    if (windTail) return;
    const absoluteY = Math.abs(effect.y); const depth = 2 + .5 * effect.y / (1 + absoluteY);
    const poleSize = unit * 1.8; const lift = (1 - enter) * unit * .4;
    const pole = { texture: 'banner-cloth-v2', frame: `${kind}-pole`, x, y: y - lift, width: poleSize, height: poleSize, alpha: fade, depth, originX: .5, originY: .9375 };
    this.draw(pole);
    const phase = (effect.x * .17 + effect.y * .31 + row) % 1;
    const frame = Math.floor((sim.clock + phase) * 8) % 6;
    const clothSize = unit * 1.45;
    const cloth = { texture: 'banner-cloth-v2', frame: `${kind}-cloth-${frame}`, x, y: y - lift - unit * 1.3, width: clothSize, height: clothSize * (.85 + .15 * enter), alpha: fade * enter, depth: depth + .001, originX: .078125, originY: .25 };
    this.draw(cloth);
  }
  private motes(effect: Effect, context: RenderContext): void {
    const data = effect.banner;
    if (!data) return;
    const { viewport, sim, playerId } = context; const unit = viewport.unit;
    const age = (effect.duration ?? 0) - effect.ttl;
    if (age < data.warmup) return;
    const kind = effect.kind.slice(7); const count = effect.owner === playerId ? 8 : 4;
    const fade = Math.min(1, effect.ttl / Math.max(.2, data.tail));
    const opacity = effect.owner === playerId ? .65 : .3;
    for (let index = 0; index < count; index += 1) {
      const life = (age * .5 + index / count) % 1;
      const angle = index * Math.PI * 2 / count + (kind === 'guard' ? 0 : age * .13);
      const inward = kind === 'energy' ? 1 - life * .65 : .96 + .04 * Math.sin(age * 2 + index);
      const radius = effect.radius * inward;
      const x = viewport.ox + (effect.x + Math.cos(angle) * radius) * unit;
      const y = viewport.oy + (effect.y + Math.sin(angle) * radius) * unit;
      const size = unit * (kind === 'wind' ? .38 : .23);
      const appearance = { texture: 'banner-vfx-v2', frame: `${kind}-mote`, x, y, width: size, height: size, alpha: opacity * fade * Math.sin(life * Math.PI), depth: 1.45, angle, additive: true };
      this.draw(appearance, true);
    }
  }
  private attack(effect: Effect, context: RenderContext): void {
    const { viewport, playerId } = context; const unit = viewport.unit;
    const field = context.sim.effects.find(entry => entry.id === effect.groupId && entry.banner && entry.ttl > 0);
    if (!field) return;
    const kind = effect.flavor?.slice(7);
    if (!kind) return;
    const duration = effect.duration ?? .4;
    const progress = Math.min(1, (duration - effect.ttl) / duration);
    const alpha = (effect.owner === playerId ? .9 : .55) * (effect.empowered ? 1 : .8);
    const x = viewport.ox + effect.x * unit; const y = viewport.oy + effect.y * unit;
    if (effect.kind === 'banner-bolt') {
      const angle = Math.atan2(effect.facingY ?? 0, effect.facingX ?? 1);
      const width = unit * (kind === 'wind' ? 1.2 : .95);
      const height = unit * (effect.width ?? .2) * 1.2;
      const headX = x + (effect.facingX ?? 1) * effect.radius * unit * progress;
      const headY = y + (effect.facingY ?? 0) * effect.radius * unit * progress;
      const bolt = { texture: 'banner-vfx-v2', frame: `${kind}-bolt`, x: headX, y: headY, width, height, alpha, angle, depth: 2.8, additive: true };
      this.draw(bolt);
      return;
    }
    const radius = kind === 'energy' ? 1 - progress : progress;
    const size = effect.radius * 2 * unit * Math.max(.035, radius) / .875;
    const wave = { texture: 'banner-vfx-v2', frame: `${kind}-edge`, x, y, width: size, height: size, alpha: alpha * (.85 - progress * .3), depth: 1.55, additive: true };
    this.draw(wave);
    const wake = { ...wave, frame: `${kind}-wave`, alpha: alpha * .16 * (1 - progress), depth: 1.5 };
    this.draw(wake, true);
    const accents = effect.owner === playerId ? 8 : 4;
    for (let index = 0; index < accents; index += 1) {
      const angle = index * Math.PI * 2 / accents + .2;
      const distance = effect.radius * unit * radius;
      const size = unit * (kind === 'guard' ? .5 : .35);
      const mote = { texture: 'banner-vfx-v2', frame: `${kind}-mote`, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance, width: size, height: size, alpha: alpha * (1 - progress * .5), angle, depth: 1.6, additive: true };
      this.draw(mote, true);
    }
  }
  private impact(effect: Effect, context: RenderContext): void {
    const kind = effect.flavor?.slice(7);
    if (!kind) return;
    const age = (effect.duration ?? .5) - effect.ttl;
    const progress = Math.min(1, age / .3);
    const size = context.viewport.unit * Math.max(.6, effect.radius * 1.5) * (.7 + .3 * progress);
    const x = context.viewport.ox + effect.x * context.viewport.unit;
    const y = context.viewport.oy + effect.y * context.viewport.unit;
    const appearance = { texture: 'banner-vfx-v2', frame: `${kind}-hit`, x, y, width: size, height: size, alpha: (effect.owner === context.playerId ? .85 : .4) * (1 - progress), depth: 3, additive: true };
    this.draw(appearance, true);
  }
  render(sim: Simulation, viewport: BattleViewport, playerId: string): void {
    this.used = 0; const context = { sim, viewport, playerId };
    if (sim.finished || sim.preparing) {
      for (const sprite of this.sprites) sprite.setVisible(false);
      return;
    }
    for (const mine of [true, false]) for (const effect of sim.effects) {
      if (effect.ttl <= 0 || (effect.owner === playerId) !== mine) continue;
      if (effect.banner) this.flag(effect, context);
      else if (effect.kind === 'banner-wave' || effect.kind === 'banner-bolt') this.attack(effect, context);
    }
    for (const mine of [true, false]) for (const effect of sim.effects) {
      if (effect.ttl <= 0 || (effect.owner === playerId) !== mine) continue;
      if (effect.banner) this.motes(effect, context);
      else if (effect.kind === 'hit' && effect.flavor?.startsWith('banner-')) this.impact(effect, context);
    }
    for (let index = this.used; index < this.sprites.length; index += 1) this.sprites[index].setVisible(false);
  }
}
