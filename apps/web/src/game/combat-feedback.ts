import { DamageLabels } from './damage-labels';
import type Phaser from 'phaser';
import type { Effect, Simulation } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import { CombatSound } from './combat-sound';
import s from './combat-feedback.module.css';

export type HealthState = 'normal' | 'low' | 'critical';
export interface FeedbackSettings { sound: boolean; shake: number; flash: number }
export const defaultFeedbackSettings: FeedbackSettings = { sound: true, shake: .65, flash: .75 };
interface Impact { effect: Effect; start: number; strength: number }

export class CombatFeedback {
  readonly sound = new CombatSound();
  settings = { ...defaultFeedbackSettings };
  private seen = new Map<string, number>();
  private impacts = new Map<string, Impact>();
  private labels: DamageLabels;
  private sprites: Phaser.GameObjects.Image[] = [];
  private lastShake = -1000;
  private previous = 0;
  private room = '';
  private warning: Phaser.GameObjects.Text;
  private warningUntil = 0;
  private edge: HTMLDivElement;
  private health: HealthState = 'normal';
  private healthRatio = 1;
  private alive = false;
  private edgeStrength = 0;
  private edgeOpacity = 0;
  private edgeTime = 0;
  private edgeAge = 0;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private scene: Phaser.Scene, private healthChanged?: (state: HealthState) => void) {
    this.labels = new DamageLabels(scene);
    this.edge = document.createElement('div');
    this.edge.className = s.edge;
    this.edge.hidden = true;
    this.edge.setAttribute('aria-hidden', 'true');
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const band = document.createElement('span'); band.dataset.side = side; this.edge.appendChild(band);
    }
    scene.game.canvas.parentElement?.appendChild(this.edge);
    const style = { fontSize: '19px', fontFamily: 'Microsoft YaHei', color: '#ffb3a1', stroke: '#211615', strokeThickness: 4 };
    this.warning = scene.add.text(0, 0, '', style); this.warning.setOrigin(.5); this.warning.setDepth(15);
  }

  receive(sim: Simulation, context: { playerId: string; roomId: string; reset: boolean }): void {
    const now = this.scene.time.now;
    if (context.reset || this.room !== context.roomId) this.reset();
    else if (now - this.previous > 800) this.reset(true);
    this.room = context.roomId; this.previous = now;
    const localPlayer = sim.players.find(player => player.id === context.playerId);
    const hp = localPlayer?.hp ?? 0; const maxHp = localPlayer?.maxHp ?? 0;
    this.receiveHealth(hp, maxHp);
    this.sound.enabled = this.settings.sound;
    for (const effect of sim.effects) {
      if (!effect.targetId || this.seen.has(effect.id)) continue;
      this.seen.set(effect.id, now + 6000);
      if (context.reset || document.hidden) continue;
      const mine = effect.targetId === context.playerId;
      const target = effect.targetKind === 'player' ? sim.players.find(item => item.id === effect.targetId) : sim.enemies.find(item => item.id === effect.targetId);
      const ratio = (effect.damage ?? 0) / (target?.maxHp ?? 100);
      const heavy = effect.flavor === 'hammer' || ratio >= .12 || effect.killed;
      const strength = heavy ? 1.5 : 1;
      const previous = this.impacts.get(effect.targetId);
      if (!previous?.effect.killed && (!previous || now - previous.start >= 65 || effect.killed)) {
        const impact = { effect, start: now, strength }; this.impacts.set(effect.targetId, impact);
      }
      const local = sim.players.find(item => item.id === context.playerId);
      const distance = local ? Math.hypot(effect.x - local.x, effect.y - local.y) : 0;
      const near = distance < 14;
      if (!near && !mine) continue;
      const owned = effect.owner === context.playerId;
      const volume = (mine || owned ? 1 : .3) * strength * Math.max(.15, 1 - distance / 18);
      const rightPan = Math.min(.8, (effect.x - (local?.x ?? effect.x)) / 10);
      const pan = mine ? 0 : Math.max(-.8, rightPan);
      const flavor = effect.kind === 'hit' ? effect.killed ? 'kill' : effect.flavor ?? 'impact' : effect.kind;
      this.sound.play(flavor, volume, pan);
      if (mine || owned) { const labelContext = { mine, heavy: Boolean(heavy), height: target && 'radius' in target ? target.radius : .65 }; this.labels.add(effect, labelContext); }
      if (mine && (effect.damage ?? 0) > 0) {
        const dx = -(effect.facingX ?? 0); const dy = -(effect.facingY ?? 0);
        const direction = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? '右侧 →' : '← 左侧' : dy > 0 ? '↓ 下方' : '↑ 上方';
        const text = `${direction}受击${heavy ? ' · 重伤' : ''}`;
        this.warning.setText(text); this.warningUntil = now + 380;
      }
      if (mine && heavy && (effect.damage ?? 0) > 0 && now - this.lastShake > 250 && this.settings.shake > 0) {
        this.lastShake = now; const intensity = .003 * this.settings.shake;
        this.scene.cameras.main.shake(95, intensity);
      }
    }
    for (const [id, expiry] of this.seen) if (expiry < now) this.seen.delete(id);
    for (const [id, impact] of this.impacts) if (now - impact.start > 350) this.impacts.delete(id);
  }

  private receiveHealth(hp: number, maxHp: number): void {
    this.alive = Number.isFinite(hp) && Number.isFinite(maxHp) && hp > 0 && maxHp > 0;
    this.healthRatio = this.alive ? hp / maxHp : 1;
    let next: HealthState = 'normal';
    if (this.alive) {
      if (this.healthRatio <= .15 || (this.health === 'critical' && this.healthRatio < .18)) next = 'critical';
      else if (this.healthRatio <= .30 || (this.health !== 'normal' && this.healthRatio < .35)) next = 'low';
    }
    if (next !== this.health) { this.health = next; this.healthChanged?.(next); }
  }

  private renderEdge(now: number, hit: number): void {
    const elapsed = Math.max(0, now - this.edgeTime); this.edgeTime = now;
    const step = Math.min(64, elapsed); this.edgeAge += step;
    let baseline = 0;
    if (this.health === 'low') baseline = .16 + (.35 - this.healthRatio) * .2;
    if (this.health === 'critical') {
      const wave = Math.cos(this.edgeAge * Math.PI * 2 / 1800);
      baseline = this.reducedMotion.matches ? .27 : .265 + wave * .035;
    }
    // 四角最多重叠两条边带，单条透明度上限使合成强度不超过 55%。
    const strongest = Math.max(baseline, hit);
    const target = Math.min(.329, strongest);
    const blend = 1 - Math.exp(-step / 100);
    this.edgeStrength = this.alive ? this.edgeStrength + (target - this.edgeStrength) * blend : 0;
    const rounded = Math.floor(this.edgeStrength * 255);
    const opacity = rounded / 255;
    if (opacity === this.edgeOpacity) return;
    this.edgeOpacity = opacity;
    this.edge.hidden = opacity === 0;
    const value = String(opacity); this.edge.style.setProperty('--edge-opacity', value);
  }

  entity(id: string): { x: number; y: number; scale: number; flash: number; killed: boolean; age: number } {
    const impact = this.impacts.get(id);
    if (!impact) return { x: 0, y: 0, scale: 1, flash: 0, killed: false, age: 0 };
    const age = this.scene.time.now - impact.start;
    const hold = impact.strength > 1 ? 40 : 0;
    const motionAge = Math.max(0, age - hold);
    const progress = Math.min(1, motionAge / 140);
    const impulse = Math.sin(progress * Math.PI) * (1 - progress) * .13 * impact.strength;
    const flash = Math.max(0, 1 - age / 100) * this.settings.flash;
    return { x: (impact.effect.facingX ?? 0) * impulse, y: (impact.effect.facingY ?? 0) * impulse, scale: 1 + impulse * .35, flash, killed: Boolean(impact.effect.killed), age };
  }

  render(sim: Simulation, viewport: BattleViewport): void {
    const now = this.scene.time.now; let used = 0;
    for (const impact of this.impacts.values()) {
      const { effect } = impact; const age = now - impact.start; if (age > 240 || used >= 48) continue;
      const target = effect.targetKind === 'player' ? sim.players.find(item => item.id === effect.targetId) : sim.enemies.find(item => item.id === effect.targetId);
      const x = viewport.ox + (target?.x ?? effect.x) * viewport.unit; const y = viewport.oy + (target?.y ?? effect.y) * viewport.unit;
      if (x < -100 || y < -100 || x > this.scene.scale.width + 100 || y > this.scene.scale.height + 100) continue;
      const row = effect.flavor === 'fireball' ? 0 : effect.flavor === 'frost' ? 1 : effect.flavor?.includes('thunder') || effect.kind === 'block' || effect.kind === 'perfect-block' || effect.kind === 'absorb' ? 2 : 3;
      const frameIndex = Math.floor(age / 60);
      const frame = row * 4 + Math.min(3, frameIndex);
      let sprite = this.sprites[used];
      if (!sprite) { sprite = this.scene.add.image(0, 0, 'ability-animation', frame); sprite.setDepth(7); this.sprites.push(sprite); }
      used += 1;
      const directional = effect.flavor === 'spear' || effect.flavor === 'slash' || effect.flavor === 'dual';
      const angle = directional ? Math.atan2(effect.facingY ?? 0, effect.facingX ?? 1) : 0;
      const size = viewport.unit * (.65 + age / 500) * impact.strength;
      const height = directional ? size * .5 : size;
      const alpha = (1 - age / 260) * (.35 + .65 * this.settings.flash);
      const playerHit = effect.targetKind === 'player'; const enemyDeath = effect.targetKind === 'enemy' && effect.killed;
      if (playerHit || enemyDeath) {
        const texture = enemyDeath ? 'dust' : effect.kind === 'block' || effect.kind === 'perfect-block' ? 'block' : effect.kind === 'absorb' ? 'absorb' : 'hurt';
        const rotation = playerHit ? Math.atan2(effect.facingY ?? 0, effect.facingX ?? 1) : age / 1000;
        const extent = enemyDeath ? size * 1.8 : size;
        sprite.setTexture('monster-vfx', texture); sprite.setDisplaySize(extent, extent); sprite.setRotation(rotation);
      } else { sprite.setTexture('ability-animation', frame); sprite.setDisplaySize(size, height); sprite.setRotation(angle); }
      sprite.setPosition(x, y); sprite.setAlpha(alpha); sprite.setVisible(true);
    }
    for (let index = used; index < this.sprites.length; index += 1) this.sprites[index].setVisible(false);
    this.labels.render(viewport);
    if (!this.alive) this.warningUntil = 0;
    const alpha = Math.max(0, (this.warningUntil - now) / 380);
    this.warning.setPosition(this.scene.scale.width / 2, this.scene.scale.height * .7); this.warning.setAlpha(alpha);
    const edge = alpha * this.settings.flash * .55;
    this.renderEdge(now, edge);
  }

  reset(preserveHealth = false): void {
    this.seen.clear(); this.impacts.clear();
    this.labels.reset();
    for (const sprite of this.sprites) sprite.setVisible(false);
    this.warningUntil = 0; this.edgeTime = this.scene.time.now;
    if (preserveHealth) return;
    this.edge.hidden = true; this.edge.style.removeProperty('--edge-opacity');
    this.edgeStrength = 0; this.edgeOpacity = 0; this.edgeAge = 0;
    this.alive = false; this.healthRatio = 1;
    if (this.health !== 'normal') { this.health = 'normal'; this.healthChanged?.('normal'); }
  }
  dispose(): void { this.sound.dispose(); this.reset(); this.edge.remove(); }
}
