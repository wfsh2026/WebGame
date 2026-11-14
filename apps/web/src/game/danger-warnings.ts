import type Phaser from 'phaser';
import type { Vec } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';

interface WarningCircle { radius: number }
interface WarningSector extends WarningCircle { angle?: number; spread?: number }
interface WarningRing extends WarningSector { innerRadius: number }
interface WarningLane { length: number; width: number; angle: number; arrows?: boolean }

export class DangerWarnings {
  private graphics: Phaser.GameObjects.Graphics;
  private viewport: BattleViewport = { unit: 32, ox: 0, oy: 0 };

  constructor(private scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(1.85);
  }

  begin(viewport: BattleViewport): void {
    this.viewport = viewport;
    this.graphics.clear();
    this.graphics.setPosition(viewport.ox, viewport.oy);
    this.graphics.setScale(viewport.unit);
  }

  private visible(point: Vec, radius: number): boolean {
    const { unit, ox, oy } = this.viewport;
    const x = ox + point.x * unit; const y = oy + point.y * unit;
    const margin = radius * unit + 2;
    return x + margin >= 0 && y + margin >= 0 && x - margin <= this.scene.scale.width && y - margin <= this.scene.scale.height;
  }

  private style(progress: number): Phaser.GameObjects.Graphics {
    const positive = Math.max(0, progress); const readiness = Math.min(1, positive);
    const width = 2 / this.viewport.unit;
    this.graphics.fillStyle(0xf58d87, .14 + readiness * .05);
    this.graphics.lineStyle(width, 0xff8078, .7 + readiness * .25);
    return this.graphics;
  }

  circle(point: Vec, shape: WarningCircle, progress: number): void {
    const visible = this.visible(point, shape.radius);
    if (shape.radius <= 0 || !visible) return;
    const graphics = this.style(progress);
    graphics.fillCircle(point.x, point.y, shape.radius);
    graphics.strokeCircle(point.x, point.y, shape.radius);
  }

  sector(point: Vec, shape: WarningSector, progress: number): void {
    const visible = this.visible(point, shape.radius);
    const spread = shape.spread ?? Math.PI * 2;
    if (shape.radius <= 0 || spread <= 0 || !visible) return;
    if (spread >= Math.PI * 2 - .001) { this.circle(point, shape, progress); return; }
    const angle = shape.angle ?? 0;
    const start = angle - spread / 2; const end = angle + spread / 2;
    const graphics = this.style(progress);
    graphics.beginPath(); graphics.moveTo(point.x, point.y);
    graphics.arc(point.x, point.y, shape.radius, start, end, false);
    graphics.closePath(); graphics.fillPath(); graphics.strokePath();
  }

  lane(point: Vec, shape: WarningLane, progress: number): void {
    const radius = Math.hypot(shape.length, shape.width) / 2;
    const visible = this.visible(point, radius);
    if (shape.length <= 0 || shape.width <= 0 || !visible) return;
    const x = Math.cos(shape.angle); const y = Math.sin(shape.angle);
    const forwardX = x * shape.length / 2; const forwardY = y * shape.length / 2;
    const sideX = -y * shape.width / 2; const sideY = x * shape.width / 2;
    const points = [
      { x: point.x - forwardX - sideX, y: point.y - forwardY - sideY },
      { x: point.x + forwardX - sideX, y: point.y + forwardY - sideY },
      { x: point.x + forwardX + sideX, y: point.y + forwardY + sideY },
      { x: point.x - forwardX + sideX, y: point.y - forwardY + sideY }
    ];
    const graphics = this.style(progress);
    graphics.fillPoints(points, true); graphics.strokePoints(points, true);
    if (!shape.arrows) return;
    const size = Math.min(.3, shape.width * .22, shape.length * .1);
    const width = 3 / this.viewport.unit;
    graphics.lineStyle(width, 0xff8078, .5);
    for (const fraction of [-1 / 6, 1 / 6]) {
      const center = { x: point.x + x * shape.length * fraction, y: point.y + y * shape.length * fraction };
      const arrow = [
        { x: center.x - x * size - y * size, y: center.y - y * size + x * size },
        { x: center.x + x * size, y: center.y + y * size },
        { x: center.x - x * size + y * size, y: center.y - y * size - x * size }
      ];
      graphics.strokePoints(arrow, false);
    }
  }

  ring(point: Vec, shape: WarningRing, progress: number): void {
    const visible = this.visible(point, shape.radius);
    const spread = Math.min(Math.PI * 2, shape.spread ?? Math.PI * 2);
    if (shape.radius <= 0 || spread <= 0 || !visible) return;
    const bounded = Math.min(shape.radius, shape.innerRadius); const inner = Math.max(0, bounded);
    if (inner <= 0) { this.sector(point, shape, progress); return; }
    const angle = shape.angle ?? 0;
    const start = angle - spread / 2; const end = angle + spread / 2;
    const desired = Math.ceil(shape.radius * spread * this.viewport.unit / 12); const segments = Math.max(24, desired);
    const graphics = this.style(progress);
    const startX = Math.cos(start); const startY = Math.sin(start);
    let outside = { x: point.x + startX * shape.radius, y: point.y + startY * shape.radius };
    let inside = { x: point.x + startX * inner, y: point.y + startY * inner };
    // Adjacent filled quads preserve the safe center in both Canvas and WebGL renderers.
    graphics.beginPath();
    for (let index = 1; index <= segments; index += 1) {
      const direction = start + spread * index / segments;
      const x = Math.cos(direction); const y = Math.sin(direction);
      const nextOutside = { x: point.x + x * shape.radius, y: point.y + y * shape.radius };
      const nextInside = { x: point.x + x * inner, y: point.y + y * inner };
      graphics.moveTo(outside.x, outside.y); graphics.lineTo(nextOutside.x, nextOutside.y);
      graphics.lineTo(nextInside.x, nextInside.y); graphics.lineTo(inside.x, inside.y); graphics.closePath();
      outside = nextOutside; inside = nextInside;
    }
    graphics.fillPath();
    graphics.beginPath(); graphics.arc(point.x, point.y, shape.radius, start, end, false); graphics.strokePath();
    graphics.beginPath(); graphics.arc(point.x, point.y, inner, start, end, false); graphics.strokePath();
    if (spread < Math.PI * 2 - .001) {
      const endX = Math.cos(end); const endY = Math.sin(end);
      graphics.lineBetween(point.x + startX * inner, point.y + startY * inner, point.x + startX * shape.radius, point.y + startY * shape.radius);
      graphics.lineBetween(point.x + endX * inner, point.y + endY * inner, point.x + endX * shape.radius, point.y + endY * shape.radius);
    }
  }
}
