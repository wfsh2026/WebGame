import type Phaser from 'phaser';
import type { Snapshot, SpawnWarningView } from '@web-game-world/contracts';
import type { BattleViewport } from './battle-entities';
import { DangerWarnings } from './danger-warnings';

interface WarningVisual { data: SpawnWarningView; deadline: number; label: Phaser.GameObjects.Text }
export class SpawnWarnings {
  private visuals = new Map<string, WarningVisual>();
  private snapshot: Snapshot | null = null;
  private warnings: DangerWarnings;
  constructor(private scene: Phaser.Scene) { this.warnings = new DangerWarnings(scene); }
  private create(data: SpawnWarningView, now: number): WarningVisual {
    const style = { fontSize: '13px', color: '#ffe0dc', stroke: '#302412', strokeThickness: 3 };
    const label = this.scene.add.text(0, 0, '', style); label.setOrigin(.5); label.setDepth(1.9);
    return { data, deadline: now + data.seconds, label };
  }
  render(snapshot: Snapshot, viewport: BattleViewport, now: number): void {
    this.warnings.begin(viewport);
    if (snapshot !== this.snapshot) {
      const seen = new Set<string>();
      const groups = new Map<string, SpawnWarningView>();
      for (const warning of snapshot.spawnWarnings ?? []) {
        const key = `${warning.wave}:${warning.x}:${warning.y}`; const previous = groups.get(key);
        if (!previous) { groups.set(key, { ...warning }); continue; }
        previous.count += warning.count; previous.seconds = Math.min(previous.seconds, warning.seconds);
        if (warning.kind.endsWith('-boss') || !previous.kind) previous.kind = warning.kind;
      }
      for (const [key, data] of groups) {
        seen.add(key);
        let visual = this.visuals.get(key);
        if (!visual) { visual = this.create(data, now); this.visuals.set(key, visual); }
        visual.data = data; visual.deadline = now + data.seconds;
      }
      for (const [key, visual] of this.visuals) {
        if (seen.has(key)) continue;
        visual.label.destroy(); this.visuals.delete(key);
      }
      this.snapshot = snapshot;
    }
    const { unit, ox, oy } = viewport;
    for (const visual of this.visuals.values()) {
      const seconds = Math.max(0, visual.deadline - now); const duration = Math.max(.001, visual.data.duration ?? 3); const bounded = Math.min(duration, seconds); const progress = 1 - bounded / duration;
      const boss = visual.data.kind.endsWith('-boss'); const elite = visual.data.kind.endsWith('-elite');
      const diameter = boss ? 2.6 : elite ? 2.1 : 1.8;
      const x = ox + visual.data.x * unit; const y = oy + visual.data.y * unit;
      const shape = { radius: diameter / 2 }; this.warnings.circle(visual.data, shape, progress);
      const prefix = boss ? '首领即将出现' : elite ? '精英即将出现' : '怪物即将出现';
      const count = visual.data.count > 1 ? ` ×${visual.data.count}` : '';
      const text = `${prefix}${count}`;
      if (visual.label.text !== text) visual.label.setText(text);
      visual.label.setPosition(x, y - diameter * unit * .55); visual.label.setAlpha(.9);
    }
  }
}
