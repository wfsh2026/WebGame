import type { Enemy, Vec } from './index';

/** Broad phase only; callers retain their exact hit tests. */
export class SpatialEnemies {
  private cells = new Map<string, Enemy[]>();
  private spare: Enemy[][] = [];
  private radius = 0;
  private order = new Map<Enemy, number>();
  rebuild(enemies: Enemy[]): void {
    for (const bucket of this.cells.values()) { bucket.length = 0; this.spare.push(bucket); }
    this.cells.clear(); this.order.clear(); this.radius = 0;
    let index = 0;
    for (const enemy of enemies) {
      this.order.set(enemy, index++);
      if (enemy.hp <= 0) continue;
      this.radius = Math.max(this.radius, enemy.radius);
      const x = Math.floor(enemy.x / 3); const y = Math.floor(enemy.y / 3); const key = `${x}:${y}`;
      let bucket = this.cells.get(key);
      if (!bucket) { bucket = this.spare.pop() ?? []; this.cells.set(key, bucket); }
      bucket.push(enemy);
    }
  }
  segment(from: Vec, to: Vec): Enemy[] {
    const radius = this.radius + .08;
    const minX = Math.min(from.x, to.x); const maxX = Math.max(from.x, to.x);
    const minY = Math.min(from.y, to.y); const maxY = Math.max(from.y, to.y);
    const left = Math.floor((minX - radius) / 3); const right = Math.floor((maxX + radius) / 3);
    const top = Math.floor((minY - radius) / 3); const bottom = Math.floor((maxY + radius) / 3);
    const found: Enemy[] = [];
    for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) {
      const key = `${x}:${y}`; const bucket = this.cells.get(key);
      if (bucket) for (const enemy of bucket) found.push(enemy);
    }
    found.sort((left, right) => (this.order.get(left) ?? 0) - (this.order.get(right) ?? 0));
    return found;
  }
}
