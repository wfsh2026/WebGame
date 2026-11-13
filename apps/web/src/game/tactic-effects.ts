import Phaser from 'phaser';
import { MonsterArt } from './monster-art';
import type { Enemy, EnemyHazard, Simulation, Vec } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import effectsUrl from '../../../../content/packs/forest-survival/assets/runtime/tactics.webp';
import effectsData from '../../../../content/packs/forest-survival/assets/runtime/tactics.json';

export function preloadTacticArt(scene: Phaser.Scene): void { scene.load.atlas('battle-tactics', effectsUrl, effectsData); }

interface ArtAppearance { size: number; height?: number; alpha?: number; rotation?: number; depth?: number }
export class TacticEffects {
  private art: MonsterArt;
  private fading = new Map<string, { item: EnemyHazard; at: number }>();
  private previous = new Map<string, EnemyHazard>();
  private sprites: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private spriteIndex = 0;
  private labelIndex = 0;
  private viewport: BattleViewport = { unit: 32, ox: 0, oy: 0 };
  constructor(private scene: Phaser.Scene) { this.art = new MonsterArt(scene); }

  render(sim: Simulation, viewport: BattleViewport): void {
    this.viewport = viewport; this.spriteIndex = 0; this.labelIndex = 0; this.art.begin(viewport);
    for (const item of sim.hazards) this.hazard(item);
    for (const enemy of sim.enemies) this.enemy(enemy, sim);
    for (const effect of sim.effects) {
      if (!effect.kind.startsWith('tactic-')) continue;
      const key = effect.kind.slice(7);
      const duration = effect.duration ?? .7; const alpha = Math.max(0, effect.ttl / duration);
      const progress = 1 - alpha;
      if (key === 'link-break') {
        const fragments = { width: effect.radius * (1.5 + progress), alpha, depth: 3.2 }; this.art.place('break', effect, fragments);
      } else {
        const appearance = { size: effect.radius * (1.5 + progress), alpha, rotation: key === 'escape' ? progress * 1.5 : 0, depth: 3.2 }; this.place(key, effect, appearance);
      }
      if (key === 'heal') this.label(effect, '生命 +25% · 灵力 +50%');
    }
    this.endHazards(sim); this.art.end();
    for (let index = this.spriteIndex; index < this.sprites.length; index += 1) this.sprites[index].setVisible(false);
    for (let index = this.labelIndex; index < this.labels.length; index += 1) this.labels[index].setVisible(false);
  }

  private place(key: string, point: Vec, appearance: ArtAppearance): void {
    const texture = `tactic-${key}`;
    let sprite = this.sprites[this.spriteIndex];
    if (!sprite) { sprite = this.scene.add.image(0, 0, 'battle-tactics', texture); this.sprites.push(sprite); }
    this.spriteIndex += 1;
    const { ox, oy, unit } = this.viewport;
    sprite.setTexture('battle-tactics', texture); sprite.setPosition(ox + point.x * unit, oy + point.y * unit);
    sprite.setDisplaySize(appearance.size * unit, (appearance.height ?? appearance.size) * unit);
    sprite.setRotation(appearance.rotation ?? 0); sprite.setAlpha(appearance.alpha ?? 1); sprite.setDepth(appearance.depth ?? 1); sprite.setVisible(true);
  }

  private label(point: Vec, text: string): void {
    let label = this.labels[this.labelIndex];
    if (!label) {
      const style = { fontSize: '11px', fontFamily: 'Microsoft YaHei, sans-serif', color: '#fff3d5', stroke: '#17251d', strokeThickness: 3 };
      label = this.scene.add.text(0, 0, text, style); label.setOrigin(.5, .5); label.setDepth(4); this.labels.push(label);
    }
    this.labelIndex += 1;
    if (label.text !== text) label.setText(text);
    const { ox, oy, unit } = this.viewport; label.setPosition(ox + point.x * unit, oy + point.y * unit); label.setVisible(true);
  }

  private hazard(item: EnemyHazard): void {
    const warning = item.age < item.delay;
    const remaining = warning ? item.delay - item.age : item.delay + item.duration - item.age;
    const textTime = Math.max(0, remaining); const timer = textTime.toFixed(1);
    if (item.kind === 'echo') {
      const radius = warning ? item.radius : (item.age - item.delay) * 2.4;
      const count = 36; const spread = Math.PI * 2 - item.gap;
      for (let index = 0; index < count; index += 1) {
        const angle = item.angle + item.gap / 2 + (index + .5) * spread / count;
        const dx = Math.cos(angle); const dy = Math.sin(angle);
        const point = { x: item.x + dx * radius * .9, y: item.y + dy * radius * .9 };
        const pulse = Math.sin(item.age * 12 + index) * .1;
        const crystal = { width: radius * .13, height: radius * .2, angle: angle + Math.PI / 2, alpha: warning ? .3 + .45 * item.age / item.delay : .85 + pulse, depth: 1.2 };
        this.art.place('crystal', point, crystal);
      }
      if (warning) { const point = { x: item.x, y: item.y - .85 }; this.label(point, `波纹 ${timer}s`); }
      return;
    }
    if (warning) {
      const progress = item.age / item.delay;
      const appearance = { width: item.radius * 2.2, alpha: .35 + progress * .55 }; this.art.place('mycelium', item, appearance);
      const labelPoint = { x: item.x, y: item.y + item.radius + .2 }; this.label(labelPoint, `${timer}s`);
      if (item.kind === 'egg') { const pulse = Math.sin(item.age * (5 + progress * 10));
        const egg = { size: .8 + pulse * .025, alpha: .65 + progress * .35 }; this.place('egg', item, egg);
        const cracks = { width: .6, alpha: progress * .6, depth: 1.3 }; this.art.place('mycelium', item, cracks); }
      else {
        const fraction = Math.min(1, item.age / item.delay);
        const point = { x: item.sourceX + (item.x - item.sourceX) * fraction, y: item.sourceY + (item.y - item.sourceY) * fraction - Math.sin(fraction * Math.PI) * .7 };
        const spore = { size: .6, depth: 3.1 }; this.place('spore', point, spore);
      }
    } else if (item.kind === 'poison') {
      const alpha = Math.min(1, remaining); const pulse = Math.sin(item.age * 4);
      const appearance = { size: item.radius * 2.2, alpha: alpha * (.9 + pulse * .07) };
      this.place('poison', item, appearance);
      const border = { width: item.radius * 2.2, alpha: alpha * .65 }; this.art.place('mycelium', item, border);
      if (item.age - item.delay < .4) { const burst = { size: item.radius, alpha: 1 - (item.age - item.delay) / .4, depth: 3.1 }; this.place('spore', item, burst); }
      const point = { x: item.x, y: item.y + item.radius + .15 }; this.label(point, `毒区 ${timer}s`);
    }
  }

  private endHazards(sim: Simulation): void {
    const now = this.scene.time.now;
    const entries: [string, EnemyHazard][] = sim.hazards.map(item => [item.id, item]);
    const current = new Map(entries);
    for (const [id, item] of this.previous) if (!current.has(id)) this.fading.set(id, { item, at: now });
    this.previous = current;
    for (const [id, entry] of this.fading) {
      const progress = (now - entry.at) / 450;
      if (progress >= 1) { this.fading.delete(id); continue; }
      const item = entry.item;
      if (item.kind === 'echo') {
        const radius = Math.max(0, item.age - item.delay) * 2.4;
        for (let index = 0; index < 18; index += 1) {
          const angle = item.angle + item.gap / 2 + (index + .5) * (Math.PI * 2 - item.gap) / 18;
          const dx = Math.cos(angle); const dy = Math.sin(angle);
          const point = { x: item.x + dx * radius, y: item.y + dy * radius };
          const crystal = { width: .25 * (1 - progress), alpha: 1 - progress, angle, depth: 1.2 };
          this.art.place('crystal', point, crystal);
        }
        continue;
      }
      const appearance = { width: item.radius * (2 - progress * .4), alpha: (1 - progress) * .6, depth: 1.1 };
      const frame = item.kind === 'egg' ? 'break' : 'mycelium'; this.art.place(frame, item, appearance);
    }
  }

  private enemy(enemy: Enemy, sim: Simulation): void {
    if (enemy.hp <= 0 || enemy.state === 'escaped') return;
    if (enemy.linkId) {
      const ally = sim.enemies.find(item => item.id === enemy.linkId && item.hp > 0);
      if (ally) {
        const dx = ally.x - enemy.x; const dy = ally.y - enemy.y; const length = Math.hypot(dx, dy);
        if (length <= 5) {
          const midpoint = { x: (ally.x + enemy.x) / 2, y: (ally.y + enemy.y) / 2 }; const angle = Math.atan2(dy, dx);
          const oscillation = Math.sin(sim.clock * 8); const pulse = Math.abs(oscillation);
          const alpha = length > 4 ? .45 + .45 * pulse : .9;
          const vine = { size: length, height: .5, rotation: angle, alpha, depth: 1.6 }; this.place('vine', midpoint, vine);
          const absoluteY = Math.abs(ally.y); const depth = 2 + .5 * ally.y / (1 + absoluteY) + .000001;
          const shield = { size: ally.radius * (2.5 + pulse * .08), alpha: .55 + pulse * .15, depth }; this.place('protection', ally, shield);
        }
      }
    }
    if (enemy.definition.behavior !== 'squirrel' || enemy.escapeLeft === undefined) return;
    const seconds = Math.ceil(enemy.escapeLeft); const point = { x: enemy.x, y: enemy.y + .85 };
    this.label(point, `逃离 ${seconds}s`);
    const glow = { size: enemy.radius * 1.8, rotation: sim.clock * .8, alpha: .2 + .2 * Math.sin(sim.clock * 5), depth: 1.7 }; this.place('acorn', enemy, glow);
    if (enemy.state === 'flee') {
      const trail = { x: enemy.x - enemy.facingX * .6, y: enemy.y - enemy.facingY * .6 };
      const angle = Math.atan2(enemy.facingY, enemy.facingX); const art = { size: .8, rotation: angle, alpha: .75, depth: 1.5 };
      this.place('acorn', trail, art);
    }
  }
}
