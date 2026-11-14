import Phaser from 'phaser';
import { createSimulation, makePlayer, planWave, step, waveWarnings } from '@web-game-world/simulation';
import type { Simulation, Vec, WaveDefinition, WaveEntry } from '@web-game-world/simulation';
import { protocolVersion } from '@web-game-world/contracts';
import type { Snapshot } from '@web-game-world/contracts';
import content from '../network/content';
import arenaUrl from '../../../../content/packs/forest-survival/assets/arena-readable.webp';
import { BattleEntities } from '../game/battle-entities';
import { SpawnWarnings } from '../game/spawn-warnings';

export interface SpawnPreviewState { running: boolean; elapsed: number; issued: number; spawned: number; living: number; pending: number; initialDistance: number; drift: number; lock: string; countdown: number; status: string }

export class SpawnPreviewScene extends Phaser.Scene {
  private sim!: Simulation;
  private entities!: BattleEntities;
  private warnings!: SpawnWarnings;
  private terrain!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Graphics;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private running = false;
  private tracked?: WaveEntry;
  private origin?: Vec;
  private initialDistance = 0;
  private published = 0;

  constructor(private report: (state: SpawnPreviewState) => void) { super({ key: 'spawn-preview' }); }
  preload(): void { BattleEntities.preload(this); this.load.image('spawn-preview-arena', arenaUrl); }
  create(): void {
    this.terrain = this.add.image(0, 0, 'spawn-preview-arena'); this.terrain.setOrigin(0); this.terrain.setDepth(-2);
    this.entities = new BattleEntities(this); this.warnings = new SpawnWarnings(this);
    this.marker = this.add.graphics(); this.marker.setDepth(1.8);
    const keyboard = this.input.keyboard;
    if (keyboard) for (const code of ['W', 'A', 'S', 'D']) this.keys[code] = keyboard.addKey(code, false);
    this.game.canvas.tabIndex = 0; this.game.canvas.setAttribute('aria-label', '刷怪效果区域，点击后使用 WASD 移动');
    this.input.on('pointerdown', () => this.game.canvas.focus());
    this.resetDemo();
    this.events.once('shutdown', () => this.entities.dispose());
  }

  resetDemo(): void {
    const wave: WaveDefinition = { interval: 60, count: 24, kinds: ['tree-normal'], groups: [{ start: 0, end: 57, interval: 3, min: 24, max: 24, behaviors: ['tree'], mode: 'scattered', rank: 'normal' }] };
    const config = { ...content, cycleWaves: false, waves: [wave] };
    const arena = { width: 30, height: 22, spawns: [{ x: 15, y: 11 }], enemySpawns: [], obstacles: [] };
    const random = Math.random; const options = { config, arena, random };
    this.sim = createSimulation(options);
    const identity = { id: 'spawn-preview-player', name: '你' }; const player = makePlayer(identity, config);
    player.x = 15; player.y = 11; player.hp = 1000000; player.maxHp = 1000000;
    player.equipment.branches = []; player.abilityStates = [];
    this.sim.players = [player]; this.running = false; this.tracked = undefined; this.origin = undefined;
    planWave(this.sim); step(this.sim, 1 / 60); this.trackPoint(); this.publish();
  }

  toggleRunning(): void { this.running = !this.running && this.sim.elapsed < 60; this.publish(); }
  approachWarning(): void {
    const point = this.tracked?.point;
    if (!point) return;
    const player = this.sim.players[0]; player.x = point.x; player.y = point.y; this.publish();
  }

  private trackPoint(): void {
    if (this.tracked) return;
    const entry = this.sim.waveQueue.find(item => item.point);
    if (!entry?.point) return;
    this.tracked = entry; this.origin = { ...entry.point };
    const player = this.sim.players[0]; const dx = entry.point.x - player.x; const dy = entry.point.y - player.y;
    this.initialDistance = Math.hypot(dx, dy);
  }

  private publish(): void {
    const entry = this.tracked; const origin = this.origin;
    const point = entry?.point; const dx = point && origin ? point.x - origin.x : 0; const dy = point && origin ? point.y - origin.y : 0;
    const drift = Math.hypot(dx, dy); const pending = entry && this.sim.waveQueue.includes(entry);
    const status = pending ? '预警中' : entry && this.sim.clock < entry.expires ? '已按锁定点出生' : '本波已结束';
    const lock = origin ? `${origin.x.toFixed(2)}, ${origin.y.toFixed(2)}` : '等待选点';
    const countdown = entry ? Math.max(0, entry.at - this.sim.clock) : 0;
    const living = this.sim.enemies.filter(enemy => enemy.hp > 0).length;
    const state = { running: this.running, elapsed: this.sim.elapsed, issued: this.sim.spawnIssued, spawned: this.sim.spawned, living, pending: this.sim.waveQueue.length, initialDistance: this.initialDistance, drift, lock, countdown, status };
    this.report(state);
  }

  update(time: number, delta: number): void {
    if (!this.sim) return;
    const player = this.sim.players[0]; const focused = document.activeElement === this.game.canvas;
    const x = focused ? Number(this.keys.D?.isDown) - Number(this.keys.A?.isDown) : 0;
    const y = focused ? Number(this.keys.S?.isDown) - Number(this.keys.W?.isDown) : 0;
    const dt = Math.min(delta / 1000, .05);
    player.input = { sequence: 0, x, y, block: false, dash: false }; player.inputAt = this.sim.clock;
    if (this.running) {
      let remaining = dt;
      while (remaining > .000001) { const duration = Math.min(remaining, 1 / 60); step(this.sim, duration); remaining -= duration; }
      this.trackPoint();
      if (this.sim.elapsed >= 60) this.running = false;
    }
    const width = this.scale.width; const height = this.scale.height;
    const unit = Math.max(width / 30, height / 22);
    const desiredX = width / 2 - player.x * unit; const desiredY = height / 2 - player.y * unit;
    const boundedX = Math.min(0, desiredX); const boundedY = Math.min(0, desiredY);
    const ox = Math.max(width - 30 * unit, boundedX); const oy = Math.max(height - 22 * unit, boundedY);
    const viewport = { unit, ox, oy };
    this.terrain.setPosition(ox, oy); this.terrain.setDisplaySize(30 * unit, 22 * unit);
    this.marker.clear();
    if (this.origin) {
      const cx = ox + this.origin.x * unit; const cy = oy + this.origin.y * unit;
      this.marker.lineStyle(2, 0xf0d68a, .9); this.marker.strokeRect(cx - 8, cy - 8, 16, 16);
    }
    const warnings = waveWarnings(this.sim);
    const snapshot: Snapshot = { protocol: protocolVersion, roomId: 'spawn-preview', hostId: player.id, stage: 'combat', round: 1, seconds: 60 - this.sim.elapsed, width: 30, height: 22, players: this.sim.players, enemies: this.sim.enemies, projectiles: [], effects: [], results: [], error: '', serverTime: time, spawnWarnings: warnings };
    const now = time / 1000; this.warnings.render(snapshot, viewport, now);
    this.entities.begin(viewport);
    for (const enemy of this.sim.enemies) {
      const appearance = { texture: enemy.kind, radius: enemy.radius, label: '', color: 0xa6adb3, rank: 'normal' };
      this.entities.render(enemy, appearance);
    }
    const appearance = { texture: 'ranger', radius: .4, label: '你', color: 0xf0d68a, mine: true };
    this.entities.render(player, appearance); this.entities.end();
    if (time - this.published >= 100) { this.published = time; this.publish(); }
  }
}
