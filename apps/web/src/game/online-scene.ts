import type { ClientBattle } from '../network/client-battle';
import { BannerEffects, preloadBannerArt } from './banner-effects';
import { CombatFeedback } from './combat-feedback';
import type { FeedbackSettings } from './combat-feedback';
import { SpawnWarnings, preloadSpawnWarning } from './spawn-warnings';
import { LootView, preloadLootArt } from './loot-view';
import type { LootPickupData } from '@web-game-world/contracts';
import { AbilityEffects, preloadAbilityArt } from './ability-effects';
import Phaser from 'phaser';
import type { Snapshot } from '@web-game-world/contracts';
import type { Controls } from '@web-game-world/simulation';
import { PresentationWorld } from './presentation-world';
import arenaUrl from '../../../../content/packs/forest-survival/assets/arena.webp';
import { BattleEntities } from './battle-entities';
import { EnemyEffects } from './enemy-effects';
import { preloadMonsterArt } from './monster-art';
import type { BattleLoading } from './battle-runtime';
import { TacticEffects } from './tactic-effects';
export interface SceneBridge { battle?: ClientBattle; active?: boolean; feedback?: FeedbackSettings; pickups: LootPickupData[]; lootTarget: (kind: string) => { x: number; y: number } | undefined; lootLanded: (kind: string) => void; current: Snapshot | null; playerId: string; send: (input: Omit<Controls, 'sequence'>) => void }
export class OnlineScene extends Phaser.Scene {
  bridge: SceneBridge;
  onLoading?: (state: BattleLoading) => void;
  loadingError = '';
  spawnWarnings!: SpawnWarnings;
  lootView!: LootView;
  entities!: BattleEntities;
  feedback!: CombatFeedback;
  abilityEffects!: AbilityEffects;
  bannerEffects!: BannerEffects;
  enemyEffects!: EnemyEffects;
  tacticEffects!: TacticEffects;
  terrain!: Phaser.GameObjects.Image;
  graphics!: Phaser.GameObjects.Graphics;
  background!: Phaser.GameObjects.Graphics;
  world: PresentationWorld;
  mapSize = '';
  previousInput = '';
  diagnostics = false;
  frameCount = 0;
  keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  sendClock = 0;
  dashPending = false;
  focusActive = false;
  constructor(bridge: SceneBridge) { super({ key: 'online-arena', visible: false }); this.bridge = bridge; this.world = new PresentationWorld(bridge.playerId); }
  preload(): void {
    this.load.on('progress', (progress: number) => { this.onLoading?.({ progress, ready: false, error: this.loadingError }); });
    this.load.on('loaderror', () => { this.loadingError = '战斗资源加载失败，请重试'; this.onLoading?.({ progress: this.load.progress, ready: false, error: this.loadingError }); });
    preloadMonsterArt(this); preloadSpawnWarning(this); preloadLootArt(this); preloadAbilityArt(this); preloadBannerArt(this); BattleEntities.preload(this); this.load.image('forest-arena', arenaUrl);
  }
  create(): void {
    if (this.load.totalFailed > 0) return;
    this.cameras.main.setBackgroundColor('#142c26'); this.terrain = this.add.image(0, 0, 'forest-arena'); this.terrain.setOrigin(0); this.terrain.setDepth(-2); this.background = this.add.graphics(); this.background.setDepth(1); this.graphics = this.add.graphics(); this.graphics.setDepth(3); this.entities = new BattleEntities(this); this.enemyEffects = new EnemyEffects(this); this.tacticEffects = new TacticEffects(this);
    this.spawnWarnings = new SpawnWarnings(this);
    this.abilityEffects = new AbilityEffects(this); this.bannerEffects = new BannerEffects(this); this.feedback = new CombatFeedback(this); this.entities.feedback = this.feedback; this.lootView = new LootView(this, this.bridge);
    const query = new URLSearchParams(location.search); this.diagnostics = query.has('diagnostics');
    const keyboard = this.input.keyboard; if (keyboard) {
      for (const code of ['W', 'A', 'S', 'D', 'SHIFT', 'SPACE']) this.keys[code] = keyboard.addKey(code, false);
      keyboard.on('keydown-SHIFT', (event: KeyboardEvent) => { if (this.focusActive && !event.repeat) this.dashPending = true; });
      keyboard.on('keydown-SPACE', (event: KeyboardEvent) => { if (this.focusActive) event.preventDefault(); });
    }
    this.game.canvas.tabIndex = 0; this.game.canvas.setAttribute('aria-label', '战斗区域，点击后使用 WASD 移动、Shift 冲刺、空格格挡');
    this.game.canvas.addEventListener('focus', this.onFocus); this.game.canvas.addEventListener('blur', this.release); window.addEventListener('blur', this.release); document.addEventListener('visibilitychange', this.onVisibility);
    this.input.on('pointerdown', () => { this.feedback.sound.unlock(); this.game.canvas.focus({ preventScroll: true }); });
    keyboard?.on('keydown', () => this.feedback.sound.unlock());
    this.onLoading?.({ progress: 1, ready: true, error: '' });
    this.events.once('shutdown', () => { this.feedback.dispose(); this.game.canvas.removeEventListener('focus', this.onFocus); this.game.canvas.removeEventListener('blur', this.release); window.removeEventListener('blur', this.release); document.removeEventListener('visibilitychange', this.onVisibility); this.release(); });
  }
  onFocus = (): void => { this.focusActive = true; };
  onVisibility = (): void => { if (document.hidden) this.release(); };
  release = (): void => { this.focusActive = false; this.dashPending = false; for (const key of Object.values(this.keys)) key.reset(); this.bridge.send({ x: 0, y: 0, block: false, dash: false }); };
  update(time: number, delta: number): void {

    const state = this.bridge.current; if (!this.bridge.active || state?.stage !== 'combat' || !this.graphics) return;
    this.world.playerId = this.bridge.playerId;
    this.world.channel = this.bridge.battle;
    this.world.receiveOwnership();
    if (this.world.lastSnapshot !== state) { const arrival = performance.now(); this.world.receive(state, arrival); }
    const active = this.focusActive;
    const x = active ? Number(this.keys.D?.isDown) - Number(this.keys.A?.isDown) : 0;
    const y = active ? Number(this.keys.S?.isDown) - Number(this.keys.W?.isDown) : 0;
    const block = active && Boolean(this.keys.SPACE?.isDown); const dash = active && this.dashPending;
    const controls = { sequence: 0, x, y, block, dash }; this.world.update(controls, delta);
    if (this.world.authoritative && !state.paused) this.bridge.battle?.submit(this.world.simulation, delta);
    const world = this.world.simulation;
    if (this.bridge.feedback) this.feedback.settings = this.bridge.feedback;
    const feedbackContext = { playerId: this.bridge.playerId, roomId: state.roomId, reset: this.world.feedbackReset };
    this.feedback.receive(world, feedbackContext); this.world.feedbackReset = false;
    const width = this.scale.width; const height = this.scale.height;
    const minimumUnit = width < 600 ? 32 : 56;
    const horizontalScale = width / state.width; const verticalScale = height / state.height;
    const unit = Math.max(minimumUnit, horizontalScale, verticalScale);
    const focus = this.world.localPlayer;
    const desiredX = width / 2 - (focus?.x ?? state.width / 2) * unit;
    const desiredY = height * .52 - (focus?.y ?? state.height / 2) * unit;
    const maxX = Math.min(0, desiredX); const maxY = Math.min(0, desiredY);
    const ox = Math.max(width - state.width * unit, maxX);
    const oy = Math.max(height - state.height * unit, maxY);
    this.terrain.setPosition(ox, oy);
    const graphics = this.graphics; graphics.clear();
    const ground = this.background; ground.clear();
    const size = `${width}:${height}`;
    if (size !== this.mapSize) {
      this.mapSize = size;
      this.terrain.setDisplaySize(state.width * unit, state.height * unit);
    }
    const viewport = { unit, ox, oy }; this.lootView.render(state, viewport); this.entities.begin(viewport); this.enemyEffects.begin(viewport);
    const warningTime = time / 1000; this.spawnWarnings.render(state, viewport, warningTime);
    for (const enemy of world.enemies) {
      if (enemy.state === 'spent' || enemy.state === 'escaped') continue;
      const rank = enemy.definition.rank ?? 'normal';
      const label = rank === 'boss' ? `BOSS ${enemy.definition.name ?? ''}` : rank === 'elite' ? `◆ ${enemy.definition.name ?? ''}` : '';
      const color = rank === 'boss' ? 0xe36968 : rank === 'elite' ? 0xe7bc6c : 0xa6adb3;
      const glow = enemy.state === 'windup' || enemy.state === 'channel' || enemy.state === 'detonating' ? 1 : 0;
      const appearance = { texture: enemy.kind, radius: enemy.radius, label, color, rank, glow };
      this.entities.render(enemy, appearance); this.enemyEffects.draw(enemy);
    }
    for (const player of world.players) {
      const mine = player.id === this.bridge.playerId;
      const name = mine ? '你' : player.name; const label = player.hp <= 0 ? `${name} · 灵魂` : name;
      const appearance = { texture: 'ranger', radius: .4, label, color: mine ? 0xf0d68a : 0x8acac8, mine };
      this.entities.render(player, appearance);
      const x = ox + player.x * unit; const y = oy + player.y * unit;
      if (player.blocking) this.enemyEffects.guard(player);
      if (player.dashLeft > 0) {
        graphics.lineStyle(5, 0xc4f3e7, .4); graphics.lineBetween(x, y, x - player.dashX * unit, y - player.dashY * unit);
      }
    }
    this.entities.end(); this.feedback.render(world, viewport); this.tacticEffects.render(world, viewport);
    this.abilityEffects.render(world, viewport, this.bridge.playerId); this.bannerEffects.render(world, viewport, this.bridge.playerId);
    for (const shot of world.projectiles) if (shot.hostile) this.enemyEffects.projectile(shot);
    for (const effect of world.effects) {
      if (effect.targetId) continue;
      if (effect.kind.startsWith('ability-') || effect.banner) continue;
      if (effect.kind.startsWith('tactic-')) continue;
      const handled = this.enemyEffects.impact(effect); if (handled) continue;
      const alpha = Math.max(0, effect.ttl / .3); const isNova = effect.kind === 'nova';
      const color = isNova ? 0x8debd2 : effect.kind === 'hurt' ? 0xf49981 : 0xffe9a3;
      const radius = effect.radius * unit; const x = ox + effect.x * unit; const y = oy + effect.y * unit;
      graphics.lineStyle(isNova ? 3 : 2, color, alpha);
      const animatedRadius = isNova ? radius * (1 - alpha * .25) : radius;
      graphics.strokeCircle(x, y, animatedRadius);
      if (isNova) {
        graphics.lineStyle(1, color, alpha * .55); graphics.strokeCircle(x, y, animatedRadius * .88);
        for (let index = 0; index < 6; index += 1) {
          const start = index * Math.PI / 3 + (1 - alpha); graphics.beginPath(); graphics.arc(x, y, animatedRadius, start, start + .35); graphics.strokePath();
        }
      }
    }
    this.enemyEffects.end();
    this.sendClock += delta;
    const inputSignature = `${x}:${y}:${block}`; const player = this.world.localPlayer;
    if (state.stage === 'combat' && player && (this.sendClock >= 50 || inputSignature !== this.previousInput || dash)) {
      this.sendClock = 0; this.previousInput = inputSignature;
      const position = { x: player.x, y: player.y, facingX: player.facingX, facingY: player.facingY };
      this.bridge.send({ x, y, block, dash, position });
    }
    this.dashPending = false;
    if (this.diagnostics && player) {
      this.frameCount += 1;
      const data = this.game.canvas.dataset; data.localX = String(player.x); data.localY = String(player.y); data.frameCount = String(this.frameCount); data.weaponCount = String(player.weaponCount);
      data.hp = String(player.hp); data.projectiles = String(world.projectiles.length); data.enemyId = world.enemies[0]?.id ?? ''; data.enemyX = String(world.enemies[0]?.x ?? 0); data.enemyY = String(world.enemies[0]?.y ?? 0);
      data.shotId = world.projectiles[0]?.id ?? ''; data.shotX = String(world.projectiles[0]?.x ?? 0); data.shotY = String(world.projectiles[0]?.y ?? 0); data.serverTime = String(state.serverTime);
    }
  }
}
