import Phaser from 'phaser';
import type { Snapshot, SpawnWarningView } from '@web-game-world/contracts';
import type { BattleViewport } from './battle-entities';
import atlas from '../../../../content/packs/forest-survival/assets/runtime/spawn-warning.webp';

interface WarningVisual { data: SpawnWarningView; deadline: number; removedAt?: number; fade: number; images: Phaser.GameObjects.Image[]; label: Phaser.GameObjects.Text }
export function preloadSpawnWarning(scene: Phaser.Scene): void { scene.load.spritesheet('spawn-warning', atlas, { frameWidth: 256, frameHeight: 256 }); }
export class SpawnWarnings {
  private visuals = new Map<string, WarningVisual>();
  private snapshot: Snapshot | null = null;
  constructor(private scene: Phaser.Scene) {}
  private create(data: SpawnWarningView, now: number): WarningVisual {
    const rank = data.kind.endsWith('-boss') ? 2 : data.kind.endsWith('-elite') ? 1 : 0;
    const images: Phaser.GameObjects.Image[] = [];
    for (const frame of [rank, 3, 4, 5]) {
      const image = this.scene.add.image(0, 0, 'spawn-warning', frame); image.setDepth(.5); images.push(image);
    }
    const style = { fontSize: '13px', color: '#ffe0a0', stroke: '#302412', strokeThickness: 3 };
    const label = this.scene.add.text(0, 0, '', style); label.setOrigin(.5); label.setDepth(1.2);
    return { data, deadline: now + data.seconds, images, label, fade: .4 };
  }
  render(snapshot: Snapshot, viewport: BattleViewport, now: number): void {
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
        visual.data = data; visual.deadline = now + data.seconds; visual.removedAt = undefined;
      }
      for (const [key, visual] of this.visuals) {
        if (seen.has(key) || visual.removedAt !== undefined) continue;
        visual.fade = visual.deadline - now > .3 ? .15 : .4; visual.removedAt = now;
      }
      this.snapshot = snapshot;
    }
    const { unit, ox, oy } = viewport;
    for (const [key, visual] of this.visuals) {
      const age = visual.removedAt === undefined ? 0 : now - visual.removedAt;
      if (visual.removedAt !== undefined && age >= visual.fade) {
        for (const image of visual.images) image.destroy(); visual.label.destroy(); this.visuals.delete(key); continue;
      }
      const seconds = Math.max(0, visual.deadline - now); const duration = visual.data.duration ?? 3; const bounded = Math.min(duration, seconds); const progress = 1 - bounded / duration;
      const boss = visual.data.kind.endsWith('-boss'); const elite = visual.data.kind.endsWith('-elite');
      const size = unit * (boss ? 2.6 : elite ? 2.1 : 1.8);
      const x = ox + visual.data.x * unit; const y = oy + visual.data.y * unit;
      const fading = visual.removedAt !== undefined; const opacity = fading ? 1 - age / visual.fade : 1;
      const pulse = seconds <= .5 ? .8 + .2 * Math.sin(now * 18) : .85 + .15 * Math.sin(now * 4);
      const [roots, cracks, leaves, dust] = visual.images;
      for (const image of visual.images) image.setPosition(x, y);
      const frame = boss ? 2 : elite ? 1 : 0; roots.setFrame(frame);
      roots.setDisplaySize(size, size); roots.setAlpha((.25 + .65 * progress) * opacity);
      cracks.setDisplaySize(size * .75, size * .75); cracks.setAlpha(progress * progress * pulse * opacity * .85);
      const leafSize = size * (fading ? 1 + age * 1.5 : 1.15 - progress * .2);
      leaves.setDisplaySize(leafSize, leafSize); leaves.setRotation(now * .6); leaves.setAlpha((.4 + progress * .5) * opacity);
      dust.setDisplaySize(size * (1 + age), size * (1 + age)); dust.setAlpha((fading ? .5 : progress * .15) * opacity);
      const prefix = boss ? '首领即将出现' : elite ? '精英即将出现' : '怪物即将出现';
      const count = visual.data.count > 1 ? ` ×${visual.data.count}` : '';
      const text = `${prefix}${count}`;
      if (visual.label.text !== text) visual.label.setText(text);
      visual.label.setPosition(x, y - size * .48); visual.label.setAlpha(fading ? 0 : .85);
    }
  }
}
