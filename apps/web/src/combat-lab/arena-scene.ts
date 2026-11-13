import Phaser from 'phaser';
import type { LabEvent } from './simulation';

export interface ArenaHandle { fire: (event: LabEvent) => void; destroy: () => void }

class CombatScene extends Phaser.Scene {
  create() {
    this.add.rectangle(320, 150, 640, 300, 0xeef2e6);
    const grid = this.add.graphics();
    grid.lineStyle(1, 0xdce3d1, 0.7);
    for (let x = 0; x <= 640; x += 40) grid.lineBetween(x, 0, x, 300);
    for (let y = 0; y <= 300; y += 40) grid.lineBetween(0, y, 640, y);
    this.add.circle(120, 158, 32, 0x315b46);
    const textStyle = { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '15px', color: '#315b46' };
    this.add.text(91, 207, '施放者', textStyle);
    this.add.rectangle(510, 157, 48, 65, 0x987653);
    this.add.circle(510, 108, 17, 0xb7956d);
    this.add.text(472, 207, '训练木桩', textStyle);
    const noteStyle = { ...textStyle, fontSize: '12px', color: '#7c8b72' };
    this.add.text(20, 22, '独立攻击计时 · 共享心法供能 · 固定目标命中', noteStyle);
  }

  fire(event: LabEvent) {
    if (!this.sys.isActive()) return;
    const color = event.kind === 'weapon' ? 0x6b9d8b : 0xdb9960;
    for (let index = 0; index < event.projectiles; index += 1) {
      const offset = (index - (event.projectiles - 1) / 2) * 24;
      const bolt = this.add.circle(144, 155 + offset, event.kind === 'weapon' ? 5 : 9, color);
      const travel = { targets: bolt, x: 510, y: 150 + offset / 3, duration: 280, onComplete: () => { bolt.destroy(); } };
      this.tweens.add(travel);
    }
    const labelStyle = { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '22px', color: event.kind === 'weapon' ? '#315b46' : '#aa643a' };
    const label = event.damage.toString();
    const damage = this.add.text(485, 85, label, labelStyle);
    const float = { targets: damage, y: 40, alpha: 0, delay: 280, duration: 650, onComplete: () => { damage.destroy(); } };
    this.tweens.add(float);
  }
}

export function createArena(parent: HTMLDivElement): ArenaHandle {
  const scene = new CombatScene('combat-lab');
  const options: Phaser.Types.Core.GameConfig = { type: Phaser.AUTO, parent, width: 640, height: 300, backgroundColor: '#eef2e6', scene: [scene], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, audio: { noAudio: true } };
  const game = new Phaser.Game(options);
  return { fire: (event) => { scene.fire(event); }, destroy: () => { game.destroy(true); } };
}
