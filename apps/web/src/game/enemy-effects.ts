import type Phaser from 'phaser';
import { enemyAttackArea, enemyBehavior } from '@web-game-world/simulation';
import type { Enemy, Effect, Projectile, Vec } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import { MonsterArt } from './monster-art';

export class EnemyEffects {
  private art: MonsterArt;
  private shots = new Map<string, Vec>();
  private currentShots = new Set<string>();
  private fragments: { point: Vec; at: number }[] = [];
  constructor(private scene: Phaser.Scene) { this.art = new MonsterArt(scene); }
  begin(viewport: BattleViewport): void { this.art.begin(viewport); this.currentShots.clear(); }
  end(): void {
    const now = this.scene.time.now;
    for (const [id, point] of this.shots) {
      if (this.currentShots.has(id)) continue;
      if (this.fragments.length < 48) this.fragments.push({ point, at: now });
      this.shots.delete(id);
    }
    this.fragments = this.fragments.filter(item => now - item.at < 250);
    for (const fragment of this.fragments) {
      const progress = (now - fragment.at) / 250;
      const appearance = { width: .5 + progress * .5, alpha: 1 - progress, angle: progress, depth: 3.2 };
      this.art.place('leaves', fragment.point, appearance);
    }
    this.art.end();
  }

  private boundary(point: Vec, area: { radius: number; angle: number; spread: number }, alpha: number): void {
    const desired = Math.ceil(area.radius * area.spread * 2); const count = Math.max(8, desired);
    const step = area.spread / count;
    for (let index = 0; index <= count; index += 1) {
      const direction = area.angle - area.spread / 2 + index * step;
      const dx = Math.cos(direction); const dy = Math.sin(direction);
      const at = { x: point.x + dx * area.radius, y: point.y + dy * area.radius };
      const appearance = { width: .45, height: .25, angle: direction + Math.PI / 2, alpha, depth: 1.15 };
      this.art.place('leaves', at, appearance);
    }
  }

  draw(enemy: Enemy): void {
    const behavior = enemyBehavior(enemy); const area = enemyAttackArea(enemy);
    const angle = Math.atan2(enemy.facingY, enemy.facingX);
    const tint = enemy.definition.rank === 'boss' ? 0xffba82 : enemy.definition.rank === 'elite' ? 0xffe4a6 : 0xffffff;
    if (behavior === 'shield') {
      const point = { x: enemy.x + enemy.facingX * enemy.radius * .65, y: enemy.y + enemy.facingY * enemy.radius * .65 };
      const absoluteY = Math.abs(enemy.y); const depth = 2 + .5 * enemy.y / (1 + absoluteY) + .000001;
      const shield = { width: enemy.radius * 2.3, angle: angle + Math.PI, depth, alpha: .8, tint };
      this.art.place('shield', point, shield);
    }
    if (enemy.state === 'charge') {
      const point = { x: enemy.x - enemy.facingX * .6, y: enemy.y - enemy.facingY * .6 };
      const trail = { width: 1.8, height: .7, angle, alpha: .7, depth: 1.7, tint }; this.art.place('dust', point, trail);
    }
    if (enemy.state !== 'windup' && enemy.state !== 'detonating') return;
    const fraction = Math.max(0, enemy.timer / enemy.definition.windup); const progress = 1 - fraction; const alpha = .35 + progress * .6;
    if (behavior === 'bomb' || behavior === 'hammer') {
      const point = behavior === 'bomb' ? enemy : area;
      const frame = behavior === 'bomb' ? 'amber' : 'cracks'; const warning = { width: area.radius * 2, alpha, tint };
      this.art.place(frame, point, warning);
      const boundary = { radius: area.radius, angle: 0, spread: Math.PI * 2 }; this.boundary(point, boundary, alpha);
      if (behavior === 'hammer') {
        const at = { x: area.x, y: area.y - .5 - fraction * .6 };
        const hammer = { width: 1.1, alpha: progress * .65, depth: 3.2 }; this.art.place('hammer', at, hammer);
      }
    } else if (behavior === 'wolf' || behavior === 'shield') {
      const point = { x: enemy.x + enemy.facingX * area.length / 2, y: enemy.y + enemy.facingY * area.length / 2 };
      const warning = { width: area.length, height: area.width, angle, alpha, tint }; this.art.place('furrow', point, warning);
      const sections = Math.ceil(area.length / .5);
      for (let index = 0; index <= sections; index += 1) {
        const along = area.length * index / sections;
        for (const side of [-1, 1]) {
          const at = { x: enemy.x + enemy.facingX * along - enemy.facingY * side * area.width / 2, y: enemy.y + enemy.facingY * along + enemy.facingX * side * area.width / 2 };
          const edge = { width: .4, height: .22, angle, alpha, tint }; this.art.place('leaves', at, edge);
        }
      }
    } else if (behavior === 'archer') {
      const count = enemy.definition.rank === 'boss' ? 5 : enemy.definition.rank === 'elite' ? 3 : 1;
      for (let index = 0; index < count; index += 1) {
        const direction = angle + (index - (count - 1) / 2) * .22; const dx = Math.cos(direction); const dy = Math.sin(direction);
        const point = { x: enemy.x + dx * enemy.definition.reach / 2, y: enemy.y + dy * enemy.definition.reach / 2 };
        const warning = { width: enemy.definition.reach, height: .22, angle: direction, alpha, tint }; this.art.place('leaves', point, warning);
        const tip = { x: enemy.x + dx * enemy.radius, y: enemy.y + dy * enemy.radius };
        const thorn = { width: .45 + progress * .2, height: .3, angle: direction, alpha, depth: 3.1 }; this.art.place('thorn', tip, thorn);
      }
    } else if (behavior === 'tree') {
      const boundary = { radius: area.radius, angle, spread: Math.PI * 2 / 3 }; this.boundary(enemy, boundary, alpha);
      const point = { x: enemy.x + enemy.facingX * area.radius * .5, y: enemy.y + enemy.facingY * area.radius * .5 };
      const roots = { width: area.radius, height: area.radius * 1.7, angle: angle + Math.PI, alpha, tint }; this.art.place('roots', point, roots);
    }
  }

  projectile(shot: Projectile): void {
    this.currentShots.add(shot.id); const point = { x: shot.x, y: shot.y }; this.shots.set(shot.id, point);
    const angle = Math.atan2(shot.vy, shot.vx); const dx = Math.cos(angle); const dy = Math.sin(angle);
    const behind = { x: shot.x - dx * .45, y: shot.y - dy * .45 };
    const trail = { width: .8, height: .28, angle, alpha: .55, depth: 3.1 }; this.art.place('leaves', behind, trail);
    const thorn = { width: .7, height: .4, angle, depth: 3.2 }; this.art.place('thorn', shot, thorn);
  }

  guard(player: Vec & { facingX: number; facingY: number }): void {
    const angle = Math.atan2(player.facingY, player.facingX);
    const point = { x: player.x + player.facingX * .45, y: player.y + player.facingY * .45 };
    const appearance = { width: .95, angle: angle + Math.PI, alpha: .75, depth: 3.1 };
    this.art.place('shield', point, appearance);
  }

  impact(effect: Effect): boolean {
    if (!effect.kind.startsWith('enemy-')) return false;
    const alpha = Math.max(0, effect.ttl / (effect.duration ?? .55)); const progress = 1 - alpha;
    const angle = Math.atan2(effect.facingY ?? 0, effect.facingX ?? 1);
    const frames: Record<string, string> = { 'enemy-sweep': 'sweep', 'enemy-shield': 'collision', 'enemy-claw': 'claw', 'enemy-smash': 'smash', 'enemy-blast': 'blast', 'enemy-shot': 'leaves' };
    const frame = frames[effect.kind]; if (!frame) return true;
    const area = effect.kind === 'enemy-smash' || effect.kind === 'enemy-blast'; const sweep = effect.kind === 'enemy-sweep';
    const radius = area || sweep ? effect.radius : .7;
    const point = { x: effect.x + (sweep ? (effect.facingX ?? 0) * radius * .5 : 0), y: effect.y + (sweep ? (effect.facingY ?? 0) * radius * .5 : 0) };
    const appearance = { width: radius * (sweep ? 1 : 2) * (.75 + progress * .25), height: radius * (sweep ? 1.7 : 2), angle: sweep ? angle + Math.PI : area ? 0 : angle, alpha, depth: 3.2 };
    this.art.place(frame, point, appearance);
    if (effect.kind === 'enemy-smash' && progress < .55) {
      const point = { x: effect.x, y: effect.y - .5 * (1 - progress / .55) };
      const hammer = { width: 1.3, alpha, depth: 3.3 }; this.art.place('hammer', point, hammer);
    }
    return true;
  }
}
