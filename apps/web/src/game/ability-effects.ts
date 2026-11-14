import novelUrl from '../../../../content/packs/forest-survival/assets/novel-skills.webp';
import Phaser from 'phaser';
import type { Effect, Projectile, Simulation } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import atlasUrl from '../../../../content/packs/forest-survival/assets/runtime/ability-atlas.webp';
import resonanceUrl from '../../../../content/packs/forest-survival/assets/runtime/resonance-atlas.webp';
import animationUrl from '../../../../content/packs/forest-survival/assets/ability-animation.webp';
import { buffTexture } from './buff-art';

interface Point { x: number; y: number }
interface Appearance { width: number; height: number; angle: number; alpha: number; top?: boolean; tint?: number; additive?: boolean; ground?: boolean }
interface TrailPoint extends Point { time: number; angle: number }
interface ShotTrail { points: TrailPoint[]; first: number; seen: number; frame: number; owner: string; effect: string; empowered: boolean }
interface RenderContext { sim: Simulation; viewport: BattleViewport; playerId: string }
const shotFrames: Record<string, number> = { blade: 4, star: 5, fireball: 6, frost: 7, 'thunder-seal': 16, 'spirit-sword': 4 };
const meleeFrames: Record<string, number> = { 'ability-slash': 0, 'ability-slash-circle': 0, 'ability-dual': 1, 'ability-dual-cross': 1, 'ability-spear': 2, 'ability-hammer': 3, 'ability-hammer-circle': 3, 'ability-thunder-staff': 18 };

export function preloadAbilityArt(scene: Phaser.Scene): void {
  scene.load.image('novel-skills', novelUrl); scene.load.image('ability-atlas', atlasUrl); scene.load.image('resonance-atlas', resonanceUrl); scene.load.image('ability-animation', animationUrl);
}
export class AbilityEffects {
  private sprites: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private trails = new Map<string, ShotTrail>();
  private used = 0;
  private usedLabels = 0;
  private previousClock = 0;
  private group = '';
  constructor(private scene: Phaser.Scene) {
    this.frames('novel-skills', 5); this.frames('ability-atlas', 4); this.frames('resonance-atlas', 2); this.frames('ability-animation', 4);
  }
  private frames(key: string, rows: number): void {
    const texture = this.scene.textures.get(key); const source = texture.getSourceImage();
    const cellWidth = source.width / 4; const cellHeight = source.height / rows;
    for (let index = 0; index < 4 * rows; index += 1) {
      if (texture.has(index)) continue;
      const row = Math.floor(index / 4); const x = Math.floor(index % 4 * cellWidth); const y = Math.floor(row * cellHeight);
      const width = Math.floor(cellWidth); const height = Math.floor(cellHeight);
      texture.add(index, 0, x, y, width, height);
    }
  }
  private draw(frame: number, position: Point, appearance: Appearance): void {
    if (this.used >= 600 || appearance.alpha <= .01 || appearance.width <= 0 || appearance.height <= 0) return;
    const margin = Math.max(appearance.width, appearance.height);
    if (position.x < -margin || position.y < -margin || position.x > this.scene.scale.width + margin || position.y > this.scene.scale.height + margin) return;
    const texture = frame >= 64 ? 'novel-skills' : frame >= 32 ? 'ability-animation' : frame >= 16 ? 'resonance-atlas' : 'ability-atlas';
    const cell = frame >= 64 ? frame - 64 : frame >= 32 ? frame - 32 : frame >= 16 ? frame - 16 : frame;
    let sprite = this.sprites[this.used];
    if (!sprite) { sprite = this.scene.add.image(0, 0, texture, cell); this.sprites.push(sprite); }
    this.used += 1; sprite.setVisible(true); sprite.setTexture(texture, cell); sprite.setPosition(position.x, position.y);
    const depth = appearance.top ? 8 : appearance.ground ? 1.3 : 1.7;
    const opacity = appearance.additive && !appearance.top ? .6 : 1;
    sprite.setDepth(depth); sprite.setDisplaySize(appearance.width, appearance.height); sprite.setRotation(appearance.angle); sprite.setAlpha(appearance.alpha * opacity);
    sprite.setTint(appearance.tint ?? 0xffffff); sprite.setBlendMode(appearance.additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
  }
  private recoveryText(position: Point, alpha: number): void {
    if (this.usedLabels >= 20) return;
    let label = this.labels[this.usedLabels];
    if (!label) {
      const style = { fontSize: '14px', color: '#a2fff4', stroke: '#143c41', strokeThickness: 3 };
      label = this.scene.add.text(0, 0, '+灵力', style); label.setOrigin(.5); label.setDepth(9); this.labels.push(label);
    }
    this.usedLabels += 1; if (label.text !== '+灵力') label.setText('+灵力'); label.setVisible(true); label.setPosition(position.x, position.y); label.setAlpha(alpha);
  }
  private screen(position: Point, viewport: BattleViewport): Point { return { x: viewport.ox + position.x * viewport.unit, y: viewport.oy + position.y * viewport.unit }; }
  private opacity(owner: string | undefined, playerId: string): number { return owner && owner !== playerId ? .18 : 1; }
  private phase(id: string): number {
    let value = 0; for (let index = 0; index < id.length; index += 1) value = (value * 31 + id.charCodeAt(index)) >>> 0;
    return (value % 1000) / 1000 * Math.PI * 2;
  }
  private status(context: RenderContext): void {
    const { sim, viewport, playerId } = context; const unit = viewport.unit;
    for (const enemy of sim.enemies) {
      const mark = enemy.thunderMarks?.[playerId];
      const residual = enemy.thunderResiduals?.[playerId] ?? 0;
      if ((!mark || mark.remaining <= 0) && residual > 0) {
        const position = this.screen(enemy, viewport); position.y -= unit * .9;
        const appearance = { width: unit * .45, height: unit * .45, angle: sim.clock, alpha: .35 + Math.sin(sim.clock * 6) * .1, additive: true }; this.draw(21, position, appearance);
      }
      if (!mark || mark.remaining <= 0) continue;
      const phase = this.phase(enemy.id); const clock = sim.clock * (mark.remaining < 1.5 ? 16 : 5) + phase;
      const pulse = .85 + .15 * Math.sin(clock); const size = unit * (.6 + .06 * pulse);
      const position = this.screen(enemy, viewport); position.y -= (enemy.radius + .55) * unit;
      position.y += Math.sin(sim.clock * 3 + phase) * unit * .04;
      const appearance = { width: size, height: size, angle: Math.sin(clock * .4) * .08, alpha: pulse, top: true };
      this.draw(mark.charged ? 21 : 17, position, appearance);
      const sparkAngle = sim.clock * 4 + phase;
      const spark = { x: position.x + Math.cos(sparkAngle) * size * .3, y: position.y + Math.sin(sparkAngle) * size * .3 };
      const sparkle = { width: unit * .22, height: unit * .22, angle: sparkAngle, alpha: pulse * .7, top: true, additive: true };
      this.draw(43, spark, sparkle);
    }
  }
  private combo(context: RenderContext): void {
    const player = context.sim.players.find(entry => entry.id === context.playerId);
    if (!player || player.hp <= 0) return;
    const unit = context.viewport.unit; const center = this.screen(player, context.viewport);
    let row = 0;
    for (const branch of player.equipment.branches) {
      const item = branch.item; const level = item.level ?? 1;
      if (level < 5 || (item.effect !== 'dual' && item.effect !== 'hammer')) continue;
      const state = player.abilityStates.find(entry => entry.itemId === item.id); const cadence = level >= 10 ? 3 : 4;
      const count = ((state?.count ?? 0) - (state?.progress?.origin ?? 0)) % cadence; const ready = count === cadence - 1;
      for (let index = 0; index < cadence - 1; index += 1) {
        const position = { x: center.x + (index - (cadence - 2) / 2) * unit * .25, y: center.y + unit * (.65 + row * .25) };
        const pulse = ready ? 1 + Math.sin(context.sim.clock * 12) * .15 : 1;
        const appearance = { width: unit * .25 * pulse, height: unit * .25 * pulse, angle: ready ? context.sim.clock * 2 : 0, alpha: index < count ? .9 : .15, additive: true };
        this.draw(item.effect === 'dual' ? 5 : 44, position, appearance);
      }
      row += 1;
    }
  }
  private projectile(shot: Projectile, context: RenderContext): void {
    const { sim, viewport, playerId } = context; const unit = viewport.unit; const frame = shotFrames[shot.effect ?? 'blade'] ?? 4;
    const angle = Math.atan2(shot.vy, shot.vx); const effect = shot.effect ?? 'blade';
    let trail = this.trails.get(shot.id);
    if (!trail && this.trails.size < 256) {
      trail = { points: [], first: sim.clock, seen: sim.clock, frame, owner: shot.owner, effect, empowered: Boolean(shot.empowered) };
      this.trails.set(shot.id, trail);
    }
    if (trail) {
      trail.seen = sim.clock; const last = trail.points[trail.points.length - 1];
      if (!last || sim.clock - last.time >= .025) { trail.points.push({ x: shot.x, y: shot.y, time: sim.clock, angle }); if (trail.points.length > 7) trail.points.shift(); }
    }
    if ((shot.delay ?? 0) > 0) {
      const owner = sim.players.find(player => player.id === shot.owner); if (!owner) return;
      const position = this.screen(owner, viewport); const pulse = .6 + .4 * Math.sin(sim.clock * 18);
      const appearance = { width: unit * .55, height: unit * .55, angle: sim.clock * 4, alpha: this.opacity(shot.owner, playerId) * pulse, additive: true };
      this.draw(frame, position, appearance); return;
    }
    const age = sim.clock - (trail?.first ?? sim.clock); const phase = this.phase(shot.id); const pulse = Math.sin(age * 24 + phase);
    const position = this.screen(shot, viewport); const alpha = this.opacity(shot.owner, playerId);
    let rotation = angle; let width = unit * .82; let height = unit * .82;
    if (effect === 'blade') rotation += age * 22;
    if (effect === 'star') { rotation += age * 7; width *= 1 + pulse * .1; height = width; }
    if (effect === 'fireball') { width *= 1.1 + pulse * .06; height *= 1 + Math.cos(age * 28 + phase) * .09; }
    if (effect === 'frost') { height *= .85 + pulse * .08; rotation += pulse * .04; }
    if (effect === 'thunder-seal') { rotation += Math.sin(age * 15 + phase) * .18; height *= .8 + Math.abs(pulse) * .2; }
    if (shot.secondary) { width *= .65; height *= .65; }
    const appearance = { width, height, angle: rotation, alpha }; this.draw(frame, position, appearance);
    if (effect === 'fireball') {
      const cell = 32 + Math.floor(age * 18) % 3; const flame = { width: width * .65, height: height * .65, angle: -rotation, alpha: alpha * .6, additive: true };
      this.draw(cell, position, flame);
    }
    this.supportAccent({ owner: shot.owner, sourceId: shot.sourceId, position, size: width, age, alpha }, context);
    if (shot.returning) {
      const wake = { width: width * 1.5, height: height * .7, angle: angle + Math.PI, alpha: alpha * .5, additive: true };
      this.draw(44 + Math.floor(age * 12) % 4, position, wake);
    }
    if (shot.empowered || shot.overload) {
      const orbit = { x: position.x + Math.cos(age * 12) * unit * .28, y: position.y + Math.sin(age * 12) * unit * .28 };
      const accent = { width: unit * .4, height: unit * .4, angle: age * 5, alpha, additive: true }; this.draw(21, orbit, accent);
    }
    if (shot.empowered) {
      const glow = { width: width * 1.45, height: height * 1.45, angle: age * 3, alpha: alpha * .8, additive: true };
      this.resonanceAccent('resonance-spark', position, glow);
    }
  }
  private tails(context: RenderContext): void {
    const { sim, viewport, playerId } = context; const unit = viewport.unit;
    for (const [id, trail] of this.trails) {
      if (sim.clock - trail.seen > .2) { this.trails.delete(id); continue; }
      const mine = trail.owner === playerId; const stride = mine ? 1 : 3;
      for (let index = 0; index < trail.points.length - 1; index += stride) {
        const point = trail.points[index]; const age = sim.clock - point.time; if (age > .18) continue;
        const fade = 1 - age / .18; const position = this.screen(point, viewport);
        const size = unit * (.18 + fade * .3); const alpha = fade * (mine ? .32 : .1);
        const frame = trail.effect === 'fireball' ? 35 : trail.effect === 'frost' ? 39 : trail.effect === 'thunder-seal' ? 43 : trail.frame;
        const appearance = { width: size, height: size * .7, angle: point.angle + age * 4, alpha, additive: true };
        this.draw(frame, position, appearance);
      }
    }
  }
  private melee(effect: Effect, context: RenderContext): void {
    const { viewport, playerId } = context; const frame = meleeFrames[effect.kind]; const unit = viewport.unit;
    const duration = effect.duration ?? .28; const p = Math.min(1, 1 - effect.ttl / duration);
    const angle = Math.atan2(effect.facingY ?? 0, effect.facingX ?? 1); const reach = effect.radius * unit;
    const origin = this.screen(effect, viewport); const alpha = this.opacity(effect.owner, playerId) * (1 - p * p);
    // Damage starts with the contact pose; the remainder is follow-through, never a delayed wind-up.
    const spear = effect.kind === 'ability-spear'; const dual = effect.kind.startsWith('ability-dual'); const cross = effect.kind === 'ability-dual-cross'; const staff = effect.kind === 'ability-thunder-staff'; const tier = (effect.level ?? 1) >= 10 ? 2 : (effect.level ?? 1) >= 5 ? 1 : 0; const direction = dual && effect.swing ? -1 : 1; const hammer = effect.kind.startsWith('ability-hammer');
    const sweep = angle + (spear ? 0 : hammer ? .2 * p : direction * .9 * p);
    const extension = spear ? .7 - .5 * p * p : hammer ? .58 - .12 * p : .5;
    const position = { x: origin.x + Math.cos(sweep) * reach * extension, y: origin.y + Math.sin(sweep) * reach * extension };
    const width = spear ? reach * (1.2 - .65 * p) : reach * (1.35 - .2 * p);
    const appearance = { width, height: spear ? (effect.width ?? .7) * unit : width, angle: sweep, alpha };
    this.draw(frame, position, appearance);
    if (dual) {
      const otherAngle = angle - direction * (.35 + .75 * p); const offset = reach * .42;
      const other = { x: origin.x + Math.cos(otherAngle) * offset, y: origin.y + Math.sin(otherAngle) * offset };
      const second = { width: width * .85, height: width * .85, angle: otherAngle + Math.PI, alpha: alpha * (cross ? .95 : .3) };
      this.draw(frame, other, second);
    }
    if (cross) {
      const burst = { width: reach * 1.25, height: reach * 1.25, angle, alpha: alpha * .65, additive: true };
      const frameIndex = Math.floor(p * 4); const cell = 44 + Math.min(3, frameIndex); this.draw(cell, position, burst);
    }
    if ((effect.kind === 'ability-slash' || staff) && (effect.angle ?? 120) > 120) {
      const arc = ((effect.angle ?? 120) - 120) * Math.PI / 360;
      for (const side of [-1, 1]) {
        const edgeAngle = angle + side * arc; const center = { x: origin.x + Math.cos(edgeAngle) * reach * .4, y: origin.y + Math.sin(edgeAngle) * reach * .4 };
        const edge = { width: reach * 1.3, height: reach * 1.3, angle: edgeAngle + p * .3, alpha: alpha * .45, additive: true };
        this.draw(frame, center, edge);
      }
    }
    if (spear && tier > 0) {
      const tip = { x: origin.x + Math.cos(angle) * reach * .85, y: origin.y + Math.sin(angle) * reach * .85 };
      const glint = { width: unit * (tier === 2 ? 1 : .65) * (1 + p), height: unit * .6, angle, alpha: alpha * .8, additive: true };
      const frameIndex = Math.floor(p * 4); const cell = 44 + Math.min(3, frameIndex); this.draw(cell, tip, glint);
    }
    if (!spear && !hammer && p > .04) {
      const behind = sweep - .22; const tail = { x: origin.x + Math.cos(behind) * reach * .5, y: origin.y + Math.sin(behind) * reach * .5 };
      const ghost = { width, height: width, angle: behind, alpha: alpha * .22, additive: true }; this.draw(frame, tail, ghost);
    }
    if (hammer) {
      const circle = effect.kind === 'ability-hammer-circle'; const center = circle ? origin : position;
      const size = reach * (circle ? 2 : 1.1); const cell = 44 + Math.min(3, Math.floor(p * 4));
      const shock = { width: size, height: size * .75, angle: 0, alpha, tint: 0xffd89b }; this.draw(cell, center, shock);
    }
    this.supportAccent({ owner: effect.owner, sourceId: effect.sourceId, position, size: unit * .8, age: p * .28, alpha }, context);
    if (effect.kind === 'ability-slash-circle') {
      const back = { x: origin.x - Math.cos(sweep) * reach * .4, y: origin.y - Math.sin(sweep) * reach * .4 };
      const blade = { width: reach * 1.4, height: reach * 1.4, angle: sweep + Math.PI, alpha }; this.draw(0, back, blade);
    }
    if (effect.empowered || effect.charged) {
      const cell = 40 + Math.min(3, Math.floor(p * 4)); const spark = { width: reach * .7, height: reach * .7, angle: sweep, alpha: alpha * .65, additive: true };
      this.draw(cell, position, spark);
    }
    if (effect.empowered) {
      const slash = { width: reach * 1.1, height: reach * 1.1, angle: sweep, alpha: alpha * .95 };
      this.resonanceAccent('resonance-slash', position, slash);
      const flare = { width: reach * .8, height: reach * .8, angle: sweep, alpha: alpha * .9, additive: true };
      this.resonanceAccent('resonance-spark', position, flare);
    }
  }
  private resonanceAccent(frame: string, position: Point, appearance: Appearance): void {
    if (this.used >= 600 || appearance.alpha <= .01) return;
    const margin = Math.max(appearance.width, appearance.height);
    if (position.x < -margin || position.y < -margin || position.x > this.scene.scale.width + margin || position.y > this.scene.scale.height + margin) return;
    let sprite = this.sprites[this.used];
    if (!sprite) { sprite = this.scene.add.image(0, 0, buffTexture, frame); this.sprites.push(sprite); }
    this.used += 1; sprite.setTexture(buffTexture, frame); sprite.setPosition(position.x, position.y);
    sprite.setDisplaySize(appearance.width, appearance.height); sprite.setRotation(appearance.angle); sprite.setAlpha(appearance.alpha);
    sprite.setDepth(1.7); sprite.clearTint(); sprite.setVisible(true);
    const blend = appearance.additive ? Phaser.BlendModes.SCREEN : Phaser.BlendModes.NORMAL;
    sprite.setBlendMode(blend);
  }
  private supportAccent(data: { owner?: string; sourceId?: string; position: Point; size: number; age: number; alpha: number }, context: RenderContext): void {
    const player = context.sim.players.find(entry => entry.id === data.owner);
    const branch = player?.equipment.branches.find(entry => entry.item.id === data.sourceId);
    if (!branch || !branch.accents.length) return;
    const { position, size, age, alpha } = data;
    for (const accent of branch.accents) {
      if (accent === 'knockback') continue;
      const level = branch.accentLevels[accent] ?? 1; const strength = level >= 5 ? 1.25 : level >= 3 ? 1.1 : 1;
      const overload = accent === 'overload'; const haste = accent === 'haste';
      const frame = overload ? 43 : haste ? 44 : 20;
      const phase = age * (haste ? 20 : 9); const pulse = .8 + Math.sin(phase) * .2;
      const offset = { x: position.x + Math.cos(phase) * size * .35, y: position.y + Math.sin(phase) * size * .25 };
      const appearance = { width: size * strength * (overload ? 1.1 : .6), height: size * (haste ? .25 : .6), angle: phase, alpha: alpha * (overload ? .6 : .35) * pulse, additive: true };
      this.draw(frame, offset, appearance);
    }
  }
  private recovery(effect: Effect, context: RenderContext): void {
    const { sim, viewport, playerId } = context; const unit = viewport.unit;
    const owner = sim.players.find(player => player.id === effect.owner); if (owner && owner.hp <= 0) return;
    const center = this.screen(owner ?? effect, viewport); const p = Math.min(1, 1 - effect.ttl / (effect.duration ?? .65));
    const alpha = this.opacity(effect.owner, playerId) * Math.sin(Math.PI * p);
    const flavor = effect.kind; const ocean = flavor.endsWith('ocean'); const spring = flavor.endsWith('spring');
    const tier = (effect.level ?? 1) >= 10 ? 2 : (effect.level ?? 1) >= 5 ? 1 : 0;
    const radius = unit * (ocean ? 1.15 : spring ? .65 : .8) * (1 + tier * .15) * (1 - p * .7);
    const ring = { width: radius * 2, height: radius * 1.1, angle: p * (spring ? 2 : .8), alpha: alpha * .35, additive: true };
    this.draw(20, center, ring);
    const cycle = flavor.endsWith('cycle'); const count = (cycle ? 4 : 2) + tier;
    for (let index = 0; index < count; index += 1) {
      const angle = p * Math.PI * (spring ? 5 : 3) + index * Math.PI * 2 / count;
      const position = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius * .6 - (spring ? Math.sin(p * Math.PI) * unit * .5 : 0) };
      const appearance = { width: unit * .34, height: unit * .34, angle: -angle, alpha, tint: 0x87fff1, additive: true };
      this.draw(5, position, appearance);
    }
    if (tier > 0 && ocean) {
      const swell = { width: radius * 2.4, height: radius * 1.4, angle: -p * 2, alpha: alpha * .25, additive: true }; this.draw(20, center, swell);
    }
    if (effect.owner === playerId && effect.empowered && cycle) {
      const position = { x: center.x, y: center.y - unit * (1 + p * .5) }; this.recoveryText(position, alpha);
    }
  }
  private impact(effect: Effect, context: RenderContext): void {
    const { viewport, playerId } = context; const p = Math.min(1, 1 - effect.ttl / (effect.duration ?? .35));
    const row = effect.kind === 'ability-explosion' ? 0 : effect.kind.endsWith('frost') ? 1 : effect.kind.includes('thunder') ? 2 : 3;
    const frame = 32 + row * 4 + Math.min(3, Math.floor(p * 4)); const position = this.screen(effect, viewport);
    const size = effect.radius * viewport.unit * 2; const alpha = this.opacity(effect.owner, playerId);
    const appearance = { width: size, height: size, angle: 0, alpha: alpha * (1 - p * .3), additive: row !== 0 };
    this.draw(frame, position, appearance);
    // The painted frames change topology; travelling fragments add continuous motion between frames.
    const count = effect.owner === playerId ? 4 : 1;
    for (let index = 0; index < count; index += 1) {
      const angle = index * Math.PI * 2 / count + .4; const distance = size * .42 * p;
      const fragment = { x: position.x + Math.cos(angle) * distance, y: position.y + Math.sin(angle) * distance };
      const shard = { width: size * .18, height: size * .18, angle: angle + p * 3, alpha: alpha * (1 - p) * .6, additive: true };
      this.draw(35 + row * 4, fragment, shard);
    }
  }
  private evolution(effect: Effect, context: RenderContext): void {
    const { sim, viewport, playerId } = context; const unit = viewport.unit;
    const origin = this.screen(effect, viewport); const age = (effect.duration ?? 1) - effect.ttl;
    const alpha = this.opacity(effect.owner, playerId);
    if (effect.kind === 'ability-ice-ground' || effect.kind === 'ability-cracked-ground') {
      const ice = effect.kind === 'ability-ice-ground'; const frameIndex = Math.floor(sim.clock * 5) % 3; const frame = (ice ? 36 : 44) + frameIndex;
      const size = effect.radius * unit * 2; const fade = Math.min(1, effect.ttl * 3);
      const appearance = { width: size, height: size, angle: ice ? sim.clock * .08 : 0, alpha: alpha * .3 * fade, additive: true, ground: true }; this.draw(frame, origin, appearance); return;
    }
    if (effect.kind === 'ability-area-edge') {
      const size = effect.radius * unit * 2; const angle = Math.atan2(effect.facingY ?? 0, effect.facingX ?? 1);
      const spear = effect.shape === 'spear'; const directional = Boolean(effect.shape) && (effect.angle ?? 0) < 360;
      const position = directional ? { x: origin.x + Math.cos(angle) * size * .23, y: origin.y + Math.sin(angle) * size * .23 } : origin;
      const appearance = { width: directional ? size * .65 : size, height: spear ? (effect.width ?? 1) * unit : directional ? size * .65 : size, angle, alpha: alpha * .35, additive: true };
      this.draw(spear ? 2 : directional ? 0 : 44, position, appearance); return;
    }
    if (effect.kind === 'ability-spread-wait') {
      const size = unit * (.4 + Math.sin(sim.clock * 8) * .08); const appearance = { width: size, height: size, angle: age * 3, alpha: alpha * .7, additive: true }; this.draw(effect.slow ? 39 : 17, origin, appearance); return;
    }
    if (effect.kind === 'ability-star-terminal' || effect.kind === 'ability-dual-finish') {
      const p = Math.min(1, age / (effect.duration ?? .35)); const size = unit * (1.1 - p * .7);
      const appearance = { width: size, height: size, angle: p * 5, alpha: alpha * (1 - p * .5), additive: true }; this.draw(effect.kind === 'ability-star-terminal' ? 5 : 1, origin, appearance); return;
    }
    if (effect.kind === 'ability-fire-pulse') {
      const p = Math.min(1, age / .3); const size = effect.radius * unit * 2 * (.5 + p * .5); const frameIndex = Math.floor(p * 4); const frame = 32 + Math.min(3, frameIndex);
      const appearance = { width: size, height: size, angle: p * .2, alpha: alpha * (1 - p * .5), additive: true }; this.draw(frame, origin, appearance); return;
    }
    if (effect.kind === 'ability-knockback') {
      const p = Math.min(1, age / .25); const angle = Math.atan2(effect.facingY ?? 0, effect.facingX ?? 1);
      const position = { x: origin.x + (effect.facingX ?? 0) * unit * p * .4, y: origin.y + (effect.facingY ?? 0) * unit * p * .4 };
      const appearance = { width: effect.radius * unit * 2, height: effect.radius * unit, angle, alpha: alpha * (1 - p), additive: true };
      const frameIndex = Math.floor(p * 4); const cell = 44 + Math.min(3, frameIndex); this.draw(cell, position, appearance); return;
    }
    if (effect.kind.startsWith('ability-transfer-')) {
      const duration = effect.duration ?? .35; const p = Math.min(1, age / duration); const target = { x: effect.facingX ?? effect.x, y: effect.facingY ?? effect.y };
      const destination = this.screen(target, viewport); const dx = destination.x - origin.x; const dy = destination.y - origin.y;
      const angle = Math.atan2(dy, dx); const frost = effect.kind.endsWith('frost');
      for (let index = 0; index < 4; index += 1) {
        const t = Math.max(0, p - index * .08); const position = { x: origin.x + dx * t, y: origin.y + dy * t };
        const appearance = { width: unit * (.45 - index * .06), height: unit * .3, angle, alpha: alpha * (1 - index * .2), additive: true };
        this.draw(frost ? 39 : 43, position, appearance);
      }
      return;
    }
    if (effect.kind === 'ability-burning') {
      const fade = Math.min(1, effect.ttl * 3); const size = effect.radius * unit * 2;
      const appearance = { width: size, height: size, angle: age * .08, alpha: alpha * .35 * fade, ground: true };
      const frame = 32 + Math.floor(age * 10) % 3; this.draw(frame, origin, appearance);
      const count = effect.owner === playerId ? 4 : 2;
      for (let index = 0; index < count; index += 1) {
        const angle = index * Math.PI * 2 / count + age * .3; const reach = size * .3;
        const position = { x: origin.x + Math.cos(angle) * reach, y: origin.y + Math.sin(angle) * reach };
        const ember = { width: size * .35, height: size * .4, angle, alpha: alpha * fade * .5, additive: true };
        this.draw(frame, position, ember);
      }
      return;
    }
    if (effect.kind === 'ability-aftershock') {
      const waiting = age < .45; const expansion = (effect.level ?? 0) >= 10 ? .75 : .45; const bounded = Math.max(0, (age - .45) / expansion); const outward = Math.min(1, bounded); const inward = (effect.level ?? 0) >= 20 && age > 1.2; const p = inward ? Math.max(0, effect.ttl / .6) : outward;
      const scale = waiting ? .55 + age : effect.ring ? Math.max(.08, p) : 1;
      const size = effect.radius * unit * 2 * scale; const frame = waiting ? 44 : 44 + Math.min(3, Math.floor(p * 4));
      const appearance = { width: size, height: size, angle: 0, alpha: alpha * (waiting ? .25 : 1 - p * .6), additive: true };
      this.draw(frame, origin, appearance); return;
    }
    if (effect.kind === 'ability-ring-frost') {
      const p = Math.min(1, age / .4); const size = effect.radius * unit * 2 * (.3 + p * .7);
      const appearance = { width: size, height: size, angle: p * .15, alpha: alpha * (1 - p * .7), additive: true };
      const frame = 36 + Math.min(3, Math.floor(p * 4)); this.draw(frame, origin, appearance); return;
    }
    this.impact(effect, context);
  }
  private novel(effect: Effect, context: RenderContext): void {
    const { sim, viewport, playerId } = context; const unit = viewport.unit; const age = (effect.duration ?? .4) - effect.ttl;
    const alpha = this.opacity(effect.owner, playerId); let center = this.screen(effect, viewport);
    if (effect.kind === 'ability-novel-beam' || effect.kind === 'ability-novel-chain' || effect.kind === 'ability-novel-transfer') {
      const beam = effect.kind === 'ability-novel-beam'; const transfer = effect.kind === 'ability-novel-transfer';
      const endpoint = beam ? { x: effect.x + (effect.facingX ?? 1) * effect.radius, y: effect.y + (effect.facingY ?? 0) * effect.radius } : { x: effect.facingX ?? effect.x, y: effect.facingY ?? effect.y };
      const end = this.screen(endpoint, viewport); const dx = end.x - center.x; const dy = end.y - center.y; const angle = Math.atan2(dy, dx); const length = Math.hypot(dx, dy);
      const position = { x: (center.x + end.x) / 2, y: (center.y + end.y) / 2 };
      const cycle = Math.floor(age * 18) % 4; const frame = (beam ? 64 : transfer ? 72 : 68) + cycle;
      const appearance = { width: length * 1.12, height: unit * (beam ? 1.2 : .7), angle, alpha: alpha * (beam ? .9 : Math.min(1, effect.ttl * 6)), additive: true };
      this.draw(frame, position, appearance); return;
    }
    const curse = effect.kind === 'ability-novel-curse'; const array = effect.kind === 'ability-novel-array'; const trap = effect.kind === 'ability-novel-trap';
    if (curse) { const target = sim.enemies.find(enemy => enemy.id === effect.targetId); if (target) center = this.screen(target, viewport); }
    const base = array ? 76 : curse || effect.kind === 'ability-novel-poison-burst' ? 72 : 80;
    const stage = Math.floor(age * 9) % 4; const frame = trap && (effect.delay ?? 0) > 0 ? 80 : base + stage;
    const size = unit * (array ? 2 : curse ? 1.2 : effect.radius * 2);
    const appearance = { width: size, height: size, angle: 0, alpha: alpha * (trap ? .4 : .9), additive: true, ground: trap || array };
    this.draw(frame, center, appearance);
    if (array) for (let index = 0; index < 3; index += 1) {
      const angle = sim.clock * 2 + index * Math.PI * 2 / 3;
      const position = { x: center.x + Math.cos(angle) * unit * .65, y: center.y + Math.sin(angle) * unit * .4 };
      const sword = { width: unit * .65, height: unit * .3, angle: angle + Math.PI / 2, alpha, additive: true }; this.draw(4, position, sword);
    }
  }
  render(sim: Simulation, viewport: BattleViewport, playerId: string): void {
    this.used = 0; this.usedLabels = 0;
    const group = sim.players.map(player => player.id).join('|');
    if (sim.clock < this.previousClock || group !== this.group) this.trails.clear();
    this.previousClock = sim.clock; this.group = group;
    const context = { sim, viewport, playerId };
    this.status(context); this.combo(context);
    // Own attacks reserve the budget before remote decoration.
    for (const mine of [true, false]) {
      for (const shot of sim.projectiles) if (!shot.hostile && (shot.owner === playerId) === mine) this.projectile(shot, context);
      for (const effect of sim.effects) {
        if ((effect.owner === playerId) !== mine || !effect.kind.startsWith('ability-')) continue;
        if (effect.kind.startsWith('ability-novel-')) this.novel(effect, context);
        else if (['ability-ice-ground', 'ability-cracked-ground', 'ability-area-edge', 'ability-spread-wait', 'ability-star-terminal', 'ability-dual-finish', 'ability-fire-pulse', 'ability-collision', 'ability-crack-burst', 'ability-spear-tip'].includes(effect.kind) || effect.kind === 'ability-knockback' || effect.kind === 'ability-burning' || effect.kind === 'ability-aftershock' || effect.kind.startsWith('ability-transfer-') || effect.kind === 'ability-ring-frost' || effect.kind === 'ability-shatter-frost') this.evolution(effect, context);
        else if (meleeFrames[effect.kind] !== undefined) this.melee(effect, context);
        else if (effect.kind.startsWith('ability-recover-') || effect.kind === 'ability-cycle') this.recovery(effect, context);
        else if (effect.kind === 'ability-explosion' || effect.kind === 'ability-thunder-burst' || effect.kind.startsWith('ability-impact-')) this.impact(effect, context);
      }
    }
    this.tails(context);
    for (let index = this.used; index < this.sprites.length; index += 1) this.sprites[index].setVisible(false);
    for (let index = this.usedLabels; index < this.labels.length; index += 1) this.labels[index].setVisible(false);
  }
}
