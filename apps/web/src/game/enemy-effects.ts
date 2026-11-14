import type Phaser from 'phaser';
import { enemyAttackArea, enemyBehavior, enemyShielded, enemyShotAngles } from '@web-game-world/simulation';
import type { Enemy, Effect, Projectile, Vec } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import { MonsterArt } from './monster-art';
import { DangerWarnings } from './danger-warnings';

export class EnemyEffects {
  private art: MonsterArt;
  private warnings: DangerWarnings;
  private shots = new Map<string, Vec>();
  private currentShots = new Set<string>();
  private fragments: { point: Vec; at: number }[] = [];
  constructor(private scene: Phaser.Scene) { this.art = new MonsterArt(scene); this.warnings = new DangerWarnings(scene); }
  begin(viewport: BattleViewport): void { this.art.begin(viewport); this.warnings.begin(viewport); this.currentShots.clear(); }
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
      const appearance = { width: .28 + progress * .25, height: .16, alpha: (1 - progress) * .65, angle: progress, depth: 3.2, glow: .3 };
      this.art.place('collision', fragment.point, appearance);
    }
    this.art.end();
  }

  draw(enemy: Enemy): void {
    const behavior = enemyBehavior(enemy); const area = enemyAttackArea(enemy);
    const angle = Math.atan2(enemy.facingY, enemy.facingX);
    const tint = enemy.definition.rank === 'boss' ? 0xffba82 : enemy.definition.rank === 'elite' ? 0xffe4a6 : 0xffffff;
    const strength = enemy.definition.rank === 'boss' ? 1 : enemy.definition.rank === 'elite' ? .8 : .6;
    if (enemyShielded(enemy) || enemy.state === 'turn') {
      const point = { x: enemy.x + enemy.facingX * enemy.radius * .65, y: enemy.y + enemy.facingY * enemy.radius * .65 };
      const absoluteY = Math.abs(enemy.y); const depth = 2 + .5 * enemy.y / (1 + absoluteY) + .000001;
      const shield = { width: enemy.radius * 2.3, angle: angle + Math.PI, depth, alpha: enemy.state === 'turn' ? .3 : .85, tint, glow: strength * .4 };
      this.art.place('shield', point, shield);
    }
    if (enemy.state === 'charge') {
      const dx = enemy.x - (enemy.originX ?? enemy.x); const dy = enemy.y - (enemy.originY ?? enemy.y);
      const distance = Math.hypot(dx, dy); const length = Math.min(2.2, distance);
      const point = { x: enemy.x - enemy.facingX * length / 2, y: enemy.y - enemy.facingY * length / 2 };
      const trail = { width: length, height: area.width * .55, angle, alpha: .8, depth: 1.8, glow: strength };
      this.art.place('trail', point, trail);
      const front = { x: enemy.x + enemy.facingX * enemy.radius * .75, y: enemy.y + enemy.facingY * enemy.radius * .75 };
      const impact = { width: .85, height: area.width * .8, angle, alpha: .9, depth: 3.2, glow: strength };
      const frame = behavior === 'wolf' ? 'claw' : 'collision'; this.art.place(frame, front, impact);
    }
    if (enemy.hp <= 0 || enemy.timer <= 0 || (enemy.state !== 'windup' && enemy.state !== 'detonating')) return;
    const duration = Math.max(.001, enemy.abilities?.windup ?? enemy.definition.windup);
    const remaining = Math.max(0, enemy.timer / duration); const fraction = Math.min(1, remaining);
    const progress = 1 - fraction;
    if (behavior === 'bomb' && enemy.definition.rank === 'boss' && enemy.state !== 'detonating') {
      const boundary = { radius: 1.4 }; this.warnings.circle(area, boundary, progress);
    } else if (behavior === 'bomb' || behavior === 'hammer') {
      const point = behavior === 'bomb' ? enemy : area;
      const boundary = { radius: area.radius }; this.warnings.circle(point, boundary, progress);
    } else if (behavior === 'wolf' || behavior === 'shield') {
      const point = { x: enemy.x + enemy.facingX * area.length / 2, y: enemy.y + enemy.facingY * area.length / 2 };
      const lane = { length: area.length, width: area.width, angle, arrows: true }; this.warnings.lane(point, lane, progress);
    } else if (behavior === 'archer') {
      const directions = enemyShotAngles(enemy);
      for (const direction of directions) { const dx = Math.cos(direction); const dy = Math.sin(direction);
        const along = enemy.radius + enemy.definition.reach / 2;
        const point = { x: enemy.x + dx * along, y: enemy.y + dy * along };
        const warning = { length: enemy.definition.reach, width: .16, angle: direction }; this.warnings.lane(point, warning, progress);
      }
    } else if (behavior === 'tree') {
      const boundary = { radius: area.radius, angle, spread: Math.PI * 2 / 3 }; this.warnings.sector(enemy, boundary, progress);
    }
  }

  projectile(shot: Projectile): void {
    this.currentShots.add(shot.id); const point = { x: shot.x, y: shot.y }; this.shots.set(shot.id, point);
    const angle = Math.atan2(shot.vy, shot.vx); const dx = Math.cos(angle); const dy = Math.sin(angle);
    const behind = { x: shot.x - dx * .45, y: shot.y - dy * .45 };
    const trail = { width: .9, height: .12, angle, alpha: .65, depth: 3.1, glow: .5 }; this.art.place('trail', behind, trail);
    const shadow = { width: .88, height: .28, angle, alpha: .9, depth: 3.15, tint: 0x211921, fill: true };
    const arrow = { width: .82, height: .2, angle, alpha: .95, depth: 3.16, glow: .65 };
    this.art.place('thorn', shot, shadow); this.art.place('thorn', shot, arrow);
  }

  impact(effect: Effect): boolean {
    if (!effect.kind.startsWith('enemy-')) return false;
    const duration = Math.max(.001, effect.duration ?? .55);
    const remaining = Math.max(0, effect.ttl / duration); const progress = 1 - Math.min(1, remaining);
    const age = progress * duration; const release = Math.min(1, age / .09);
    const tailDuration = Math.max(.001, duration - .12); const tail = Math.max(0, (age - .12) / tailDuration);
    const alpha = 1 - tail * tail;
    const angle = Math.atan2(effect.facingY ?? 0, effect.facingX ?? 1);
    const frames: Record<string, string> = { 'enemy-sweep': 'sweep', 'enemy-shield': 'collision', 'enemy-claw': 'claw', 'enemy-smash': 'smash', 'enemy-blast': 'blast', 'enemy-shot': 'trail' };
    const frame = frames[effect.kind]; if (!frame) return true;
    const area = effect.kind === 'enemy-smash' || effect.kind === 'enemy-blast'; const sweep = effect.kind === 'enemy-sweep';
    const radius = area || sweep ? effect.radius : .7;
    const point = { x: effect.x + (sweep ? (effect.facingX ?? 0) * radius * .5 : 0), y: effect.y + (sweep ? (effect.facingY ?? 0) * radius * .5 : 0) };
    const scale = area ? 1 : .8 + release * .2;
    const appearance = { width: radius * (sweep ? 1 : 2) * scale, height: radius * (sweep ? 1.7 : effect.kind === 'enemy-shot' ? .35 : 2), angle: sweep ? angle + Math.PI : area ? 0 : angle, alpha, depth: 3.2, glow: 1 - progress * .65 };
    this.art.place(frame, point, appearance);
    if (area && age < .2) {
      const burst = { width: radius * .65, height: radius * .65, alpha: 1 - age / .2, depth: 3.25, glow: 1, additive: true };
      this.art.place('collision', point, burst);
    }
    if (effect.kind === 'enemy-smash' && progress < .55) {
      const point = { x: effect.x, y: effect.y - .65 * (1 - release) };
      const hammer = { width: 1.4, height: 1.5, angle: -.15 * (1 - release), alpha: alpha * (1 - progress / .55), depth: 3.3, glow: .7 }; this.art.place('hammer', point, hammer);
    }
    return true;
  }
}
