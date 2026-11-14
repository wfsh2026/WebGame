import Phaser from 'phaser';
import { MonsterArt } from './monster-art';
import { DangerWarnings } from './danger-warnings';
import type { Enemy, EnemyHazard, Simulation, Vec } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import effectsUrl from '../../../../content/packs/forest-survival/assets/runtime/tactics.webp';
import effectsData from '../../../../content/packs/forest-survival/assets/runtime/tactics.json';

export function preloadTacticArt(scene: Phaser.Scene): void { scene.load.atlas('battle-tactics', effectsUrl, effectsData); }

interface ArtAppearance { size: number; height?: number; alpha?: number; rotation?: number; depth?: number; glow?: number }
const glowingTactics = new Set(['poison', 'spore', 'vine', 'protection', 'egg', 'hatch']);
export class TacticEffects {
  private art: MonsterArt;
  private warnings: DangerWarnings;
  private fading = new Map<string, { item: EnemyHazard; at: number }>();
  private previous = new Map<string, EnemyHazard>();
  private sprites: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private spriteIndex = 0;
  private labelIndex = 0;
  private viewport: BattleViewport = { unit: 32, ox: 0, oy: 0 };
  constructor(private scene: Phaser.Scene) { this.art = new MonsterArt(scene); this.warnings = new DangerWarnings(scene); }

  render(sim: Simulation, viewport: BattleViewport): void {
    this.viewport = viewport; this.spriteIndex = 0; this.labelIndex = 0; this.art.begin(viewport); this.warnings.begin(viewport);
    for (const item of sim.hazards) this.hazard(item);
    for (const enemy of sim.enemies) this.enemy(enemy, sim);
    for (const effect of sim.effects) {
      if (!effect.kind.startsWith('tactic-')) continue;
      const key = effect.kind.slice(7);
      const duration = effect.duration ?? .7; const alpha = Math.max(0, effect.ttl / duration);
      const progress = 1 - alpha;
      if (key === 'link-break') {
        for (const side of [-1, 1]) {
          const point = { x: effect.x + side * progress * .45, y: effect.y + progress * .15 };
          const fragments = { width: effect.radius * .8, height: .18, angle: side * progress, alpha, depth: 3.2, glow: .4 };
          this.art.place('vine', point, fragments);
        }
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
    if (glowingTactics.has(key)) {
      const material = { width: appearance.size, height: appearance.height, angle: appearance.rotation, alpha: appearance.alpha, depth: appearance.depth, glow: appearance.glow ?? .55 };
      this.art.place(key, point, material); return;
    }
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
    if (item.age > item.delay + item.duration) return;
    const warning = item.age < item.delay;
    const remaining = warning ? item.delay - item.age : item.delay + item.duration - item.age;
    const textTime = Math.max(0, remaining); const timer = textTime.toFixed(1);
    if (item.kind === 'root' || item.kind === 'ring' || item.kind === 'blast') { this.attackHazard(item); return; }
    if (item.kind === 'echo') {
      this.echo(item);
      return;
    }
    if (warning) {
      const progress = item.age / item.delay;
      const boundary = { radius: item.radius }; this.warnings.circle(item, boundary, progress);
      const labelPoint = { x: item.x, y: item.y + item.radius + .2 }; this.label(labelPoint, `${timer}s`);
    } else if (item.kind === 'poison') {
      const alpha = Math.min(1, remaining); const pulse = Math.sin(item.age * 4);
      const appearance = { size: item.radius * 2, alpha: alpha * (.9 + pulse * .04), depth: 1.4, glow: .55 + pulse * .08 };
      this.place('poison', item, appearance);
      if (item.age - item.delay < .3) { const burst = { size: item.radius * .65, alpha: 1 - (item.age - item.delay) / .3, depth: 3.1, glow: .8 }; this.place('spore', item, burst); }
      const point = { x: item.x, y: item.y + item.radius + .15 }; this.label(point, `毒区 ${timer}s`);
    }
  }

  private echo(item: EnemyHazard): void {
    const spread = Math.PI * 2 - item.gap; const angle = item.angle + Math.PI;
    if (item.age < item.delay) {
      const progress = item.age / item.delay;
      const boundary = { radius: item.radius + .15, angle, spread }; this.warnings.sector(item, boundary, progress);
      const remaining = Math.max(0, item.delay - item.age); const timer = remaining.toFixed(1);
      const point = { x: item.x, y: item.y - .85 }; this.label(point, `波纹 ${timer}s`);
      return;
    }
    const travelled = (item.age - item.delay) * 2.4; const radius = Math.min(item.radius, travelled);
    const desired = Math.ceil(radius * spread / .65); const count = Math.max(6, desired);
    for (let index = 0; index < count; index += 1) {
      const direction = item.angle + item.gap / 2 + (index + .5) * spread / count;
      const x = Math.cos(direction); const y = Math.sin(direction);
      const point = { x: item.x + x * radius, y: item.y + y * radius };
      const crystal = { width: .4, height: .15, angle: direction + Math.PI / 2, alpha: .85, depth: 1.8, glow: .45 };
      this.art.place('crystal', point, crystal);
    }
  }

  private attackHazard(item: EnemyHazard): void {
    if (item.age < item.delay) {
      const progress = item.age / item.delay;
      if (item.kind === 'root') {
        const lane = { length: item.length ?? item.radius * 2, width: item.width ?? .7, angle: item.angle };
        this.warnings.lane(item, lane, progress);
      } else if (item.kind === 'ring') {
        const boundary = { radius: item.radius, innerRadius: item.innerRadius ?? 0 };
        this.warnings.ring(item, boundary, progress);
      } else {
        const boundary = { radius: item.radius }; this.warnings.circle(item, boundary, progress);
      }
      const remaining = Math.max(0, item.delay - item.age); const timer = remaining.toFixed(1);
      const point = { x: item.x, y: item.y + (item.kind === 'root' ? .65 : item.radius + .2) };
      const name = item.kind === 'root' ? '根刺' : item.kind === 'ring' ? '外圈' : '爆发'; this.label(point, `${name} ${timer}s`);
      return;
    }
    const duration = Math.max(.001, item.duration); const age = Math.max(0, item.age - item.delay);
    const fade = 1 - .6 * age / duration; const alpha = .95 * fade;
    if (item.kind === 'root') {
      const length = item.length ?? item.radius * 2; const width = item.width ?? .7;
      const appearance = { width: length, height: width, angle: item.angle, alpha, depth: 3.1, glow: .8 };
      this.art.place('roots', item, appearance);
    } else if (item.kind === 'ring') {
      const inner = item.innerRadius ?? 0; const thickness = item.radius - inner;
      const desired = Math.ceil(thickness / .65); const rings = Math.max(1, desired);
      for (let ring = 0; ring < rings; ring += 1) {
        const radius = inner + thickness * (ring + .5) / rings; const count = Math.ceil(radius * 8);
        for (let index = 0; index < count; index += 1) {
          const angle = index * Math.PI * 2 / count; const dx = Math.cos(angle); const dy = Math.sin(angle);
          const point = { x: item.x + dx * radius, y: item.y + dy * radius };
          const height = Math.min(.45, thickness);
          const appearance = { width: .65, height, angle: angle + Math.PI / 2, alpha: alpha * .8, depth: 1.25, glow: .25 }; this.art.place('cracks', point, appearance);
        }
      }
    } else {
      const appearance = { width: item.radius * 2, alpha, depth: 3.1, glow: .9 * fade };
      this.art.place('blast', item, appearance);
    }
  }

  private endHazards(sim: Simulation): void {
    const now = this.scene.time.now;
    const entries: [string, EnemyHazard][] = sim.hazards.map(item => [item.id, item]);
    const current = new Map(entries);
    for (const [id, item] of this.previous) if (!current.has(id)) this.fading.set(id, { item, at: now });
    this.previous = current;
    for (const [id, entry] of this.fading) {
      const progress = (now - entry.at) / 225;
      if (progress >= 1) { this.fading.delete(id); continue; }
      const item = entry.item;
      if (item.kind === 'root' || item.kind === 'ring' || item.kind === 'blast' || item.kind === 'egg') continue;
      if (item.kind === 'echo') {
        const crystal = { width: .3 * (1 - progress), height: .1, alpha: (1 - progress) * .3, depth: 1.2, glow: 0 };
        this.art.place('crystal', item, crystal);
        continue;
      }
      // Expired poison leaves only a small fading spore, never an apparently active perimeter.
      const appearance = { width: .3 * (1 - progress), alpha: (1 - progress) * .25, depth: 1.2 };
      this.art.place('spore', item, appearance);
    }
  }

  private enemy(enemy: Enemy, sim: Simulation): void {
    if (enemy.hp <= 0 || enemy.state === 'escaped') return;
    const links = enemy.abilities?.links ?? (enemy.linkId ? [enemy.linkId] : []);
    for (const id of links) {
      const ally = sim.enemies.find(item => item.id === id && item.hp > 0);
      if (ally) {
        const dx = ally.x - enemy.x; const dy = ally.y - enemy.y; const length = Math.hypot(dx, dy);
        if (length <= 5) {
          const midpoint = { x: (ally.x + enemy.x) / 2, y: (ally.y + enemy.y) / 2 }; const angle = Math.atan2(dy, dx);
          const oscillation = Math.sin(sim.clock * 8); const pulse = Math.abs(oscillation);
          const alpha = length > 4 ? .45 + .45 * pulse : .9;
          const vine = { size: length, height: .18, rotation: angle, alpha, depth: 1.6, glow: .4 }; this.place('vine', midpoint, vine);
          for (let index = 0; index < 2; index += 1) {
            const fraction = (sim.clock * .65 + index * .5) % 1;
            const point = { x: enemy.x + dx * fraction, y: enemy.y + dy * fraction };
            const node = { size: .22, alpha: alpha * .85, depth: 1.7, glow: .5 }; this.place('protection', point, node);
          }
          const absoluteY = Math.abs(ally.y); const depth = 2 + .5 * ally.y / (1 + absoluteY) + .000001;
          const shield = { size: ally.radius * (2.5 + pulse * .08), alpha: .6 + pulse * .12, depth, glow: .45 }; this.place('protection', ally, shield);
        }
      }
    }
    if (enemy.definition.behavior !== 'squirrel' || enemy.escapeLeft === undefined) return;
    const seconds = Math.ceil(enemy.escapeLeft); const point = { x: enemy.x, y: enemy.y + enemy.radius + .4 };
    this.label(point, `逃离 ${seconds}s`);
    const glow = { size: enemy.radius * 1.8, rotation: sim.clock * .8, alpha: .2 + .2 * Math.sin(sim.clock * 5), depth: 1.7 }; this.place('acorn', enemy, glow);
    if (enemy.state === 'flee') {
      const trail = { x: enemy.x - enemy.facingX * .6, y: enemy.y - enemy.facingY * .6 };
      const angle = Math.atan2(enemy.facingY, enemy.facingX); const art = { size: .8, rotation: angle, alpha: .75, depth: 1.5 };
      this.place('acorn', trail, art);
    }
  }
}
