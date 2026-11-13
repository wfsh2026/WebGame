import Phaser from 'phaser';
import { defaultFeedbackSettings } from './combat-feedback';
import type { FeedbackSettings } from './combat-feedback';
import { OnlineScene } from './online-scene';
import type { SceneBridge } from './online-scene';

export interface BattleLoading { progress: number; ready: boolean; error: string }
export class BattleRuntime {
  private game?: Phaser.Game;
  private host?: HTMLDivElement;
  private scene?: OnlineScene;
  private parent?: HTMLDivElement;
  private listeners = new Set<(state: BattleLoading) => void>();
  private state: BattleLoading = { progress: 0, ready: false, error: '' };
  constructor(private bridge: SceneBridge) {
    this.bridge.feedback = { ...defaultFeedbackSettings };
    try {
      const saved = localStorage.getItem('combat-feedback');
      if (saved) {
        const value = JSON.parse(saved);
        if (typeof value.sound === 'boolean' && [0, .35, .65, 1].includes(value.shake) && [0, .35, .75, 1].includes(value.flash)) this.bridge.feedback = value;
      }
    } catch { /* 默认设置仍可使用。 */ }
  }
  get feedbackSettings(): FeedbackSettings { return this.bridge.feedback ?? defaultFeedbackSettings; }
  setFeedback(settings: FeedbackSettings): void {
    this.bridge.feedback = settings;
    try { const value = JSON.stringify(settings); localStorage.setItem('combat-feedback', value); } catch { /* 设置继续在当前页面生效。 */ }
    if (this.scene?.feedback) { this.scene.feedback.settings = settings; this.scene.feedback.sound.enabled = settings.sound; this.scene.feedback.sound.unlock(); }
  }

  subscribe(listener: (state: BattleLoading) => void): () => void {
    this.listeners.add(listener); listener(this.state);
    return () => { this.listeners.delete(listener); };
  }
  private publish(state: BattleLoading): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
  prepare(): void {
    if (this.game) return;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;visibility:hidden;pointer-events:none;';
    document.body.appendChild(host); this.host = host;
    const scene = new OnlineScene(this.bridge); this.scene = scene;
    scene.onLoading = state => {
      if (this.scene !== scene) return;
      this.publish(state);
      if (state.ready && this.parent) this.focus();
    };
    const config: Phaser.Types.Core.GameConfig = { type: Phaser.AUTO, parent: host, width: window.innerWidth, height: window.innerHeight, backgroundColor: '#142c26', scale: { mode: Phaser.Scale.RESIZE }, scene: [scene], render: { antialias: true }, fps: { target: 60, limit: 60 }, loader: { maxParallelDownloads: 4, timeout: 20000 } };
    try { this.game = new Phaser.Game(config); }
    catch { this.host?.remove(); this.publish({ progress: 0, ready: false, error: '战斗画面初始化失败，请重试' }); return; }
    if (this.parent) this.attach(this.parent);
  }
  attach(parent: HTMLDivElement): void {
    this.parent = parent; this.bridge.active = true;
    this.prepare();
    if (!this.host) return;
    if (this.scene) this.scene.sys.settings.visible = true;
    parent.appendChild(this.host);
    this.host.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    if (this.game?.isBooted) this.game.scale.refresh();
    if (this.state.ready) this.focus();
  }
  setPaused(paused: boolean): void {
    if (!this.scene || !this.state.ready) return;
    if (paused && !this.scene.scene.isPaused()) { this.scene.release(); this.scene.scene.pause(); }
    else if (!paused && this.scene.scene.isPaused()) { this.scene.scene.resume(); this.focus(); }
  }
  private focus(): void { this.game?.canvas.focus({ preventScroll: true }); }
  detach(): void {
    this.setPaused(false);
    this.parent = undefined; this.bridge.active = false;
    if (this.scene) this.scene.sys.settings.visible = false;
    if (this.state.ready) { this.scene?.release(); this.scene?.feedback?.reset(); if (this.scene) this.scene.world.feedbackReset = true; }
    if (!this.host) return;
    this.host.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;visibility:hidden;pointer-events:none;';
    document.body.appendChild(this.host);
  }
  retry(): void {
    const oldHost = this.host;
    this.game?.destroy(true); oldHost?.remove();
    this.game = undefined; this.host = undefined; this.scene = undefined;
    this.publish({ progress: 0, ready: false, error: '' });
    this.prepare();
  }
  dispose(): void {
    this.bridge.active = false; this.game?.destroy(true); this.host?.remove();
    this.game = undefined; this.host = undefined; this.parent = undefined; this.scene = undefined;
    this.state = { progress: 0, ready: false, error: '' };
  }
}
