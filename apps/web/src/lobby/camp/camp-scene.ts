import Phaser from 'phaser';
import { campBackground, campPortrait, campShop, campShopPlacement } from './camp-assets';

export interface CampBridge { blocked: boolean; name: string; speed: number; reducedMotion: boolean; onReady: () => void; onProgress?: (progress: number) => void; onLoadError?: () => void }
const walkable = [495, 510, 780, 345, 1000, 345, 1160, 550, 1510, 590, 1290, 745, 1150, 825, 600, 885, 440, 820, 540, 670, 390, 550];

export class CampScene extends Phaser.Scene {
  private bridge: CampBridge;
  private held = new Set<string>();
  private avatar?: Phaser.GameObjects.Container;
  private direction?: Phaser.GameObjects.Triangle;
  private field = new Phaser.Geom.Polygon(walkable);
  private glow?: Phaser.GameObjects.Arc;
  private failed?: Phaser.GameObjects.Text;
  private position = { x: 839, y: 660 };

  constructor(bridge: CampBridge) { super('forest-camp'); this.bridge = bridge; }

  preload(): void {
    this.load.image('camp', campBackground);
    this.load.image('concept', campPortrait);
    this.load.image('camp-shop', campShop);
    this.load.on('progress', (progress: number) => { this.bridge.onProgress?.(progress); });
    this.load.on('loaderror', () => { this.bridge.onLoadError?.(); });
  }

  create(): void {
    const hasCamp = this.textures.exists('camp');
    if (hasCamp) { const background = this.add.image(836, 470.5, 'camp'); background.setDepth(-1); }
    else this.failed = this.add.text(520, 400, '营地背景加载失败，请刷新页面', { fontSize: '24px', color: '#ffe7ad' });
    if (this.textures.exists('camp-shop')) {
      const shop = this.add.image(campShopPlacement.x, campShopPlacement.y, 'camp-shop');
      shop.setOrigin(0.5, campShopPlacement.originY);
      shop.setDisplaySize(campShopPlacement.size, campShopPlacement.size);
      shop.setDepth(campShopPlacement.y);
    }
    const portraitTexture = this.textures.get('concept');
    const circularTexture = this.textures.createCanvas('portrait-circle', 88, 88);
    if (circularTexture) {
      const context = circularTexture.context;
      const source = portraitTexture.getSourceImage();
      context.save();
      context.beginPath();
      context.arc(44, 44, 44, 0, Math.PI * 2);
      context.clip();
      context.drawImage(source, 0, 0);
      context.restore();
      circularTexture.refresh();
    }
    const shadow = this.add.ellipse(0, 36, 86, 24, 0x131b12, 0.4);
    const portrait = this.add.image(0, 0, 'portrait-circle');
    portrait.setDisplaySize(80, 80);
    const border = this.add.circle(0, 0, 41, 0x000000, 0);
    border.setStrokeStyle(2, 0xe1c789);
    const label = this.add.text(0, -64, this.bridge.name, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '18px', color: '#fff4d6', backgroundColor: '#283025bb', padding: { x: 12, y: 4 } });
    label.setOrigin(0.5);
    this.direction = this.add.triangle(0, 51, -5, -3, 5, -3, 0, 4, 0xf5d69b);
    this.avatar = this.add.container(839, 660, [shadow, portrait, border, label, this.direction]);
    const avatarDepth = this.position.y + 35;
    this.avatar.setDepth(avatarDepth);
    this.glow = this.add.circle(617, 505, 34, 0xffba53, 0.1);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown', this.keyDown, this);
    keyboard?.on('keyup', this.keyUp, this);
    window.addEventListener('blur', this.clearKeys);
    document.addEventListener('visibilitychange', this.clearKeys);
    this.events.once('shutdown', () => {
      window.removeEventListener('blur', this.clearKeys);
      document.removeEventListener('visibilitychange', this.clearKeys);
      this.held.clear();
    });
    const canvas = this.game.canvas;
    canvas.setAttribute('aria-label', '林间营地，WASD 移动，点击场景设施打开界面');
    this.bridge.onReady();
  }

  private keyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (this.bridge.blocked || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || event.ctrlKey || event.metaKey || event.altKey) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) { event.preventDefault(); this.held.add(event.code); }
  }

  private keyUp(event: KeyboardEvent): void { this.held.delete(event.code); }
  private clearKeys = (): void => { this.held.clear(); };

  private legal(x: number, y: number): boolean {
    // 按脚底坐标限制在营地道路与空地；篝火和原木区不可穿过。
    const inside = Phaser.Geom.Polygon.Contains(this.field, x, y + 35);
    const dx = (x - 620) / 146;
    const dy = (y + 35 - 490) / 90;
    return inside && dx * dx + dy * dy > 1;
  }

  update(time: number, delta: number): void {
    if (this.glow) this.glow.alpha = this.bridge.reducedMotion ? 0.08 : 0.08 + Math.sin(time / 330) * 0.025;
    if (!this.avatar || this.failed) return;
    if (this.bridge.blocked || document.hidden) { this.held.clear(); return; }
    const dx = Number(this.held.has('KeyD')) - Number(this.held.has('KeyA'));
    const dy = Number(this.held.has('KeyS')) - Number(this.held.has('KeyW'));
    const length = Math.hypot(dx, dy);
    if (!length) return;
    const step = Math.min(delta, 40) / 1000 * this.bridge.speed * 60;
    const x = this.position.x + dx / length * step;
    const y = this.position.y + dy / length * step;
    const legalX = this.legal(x, this.position.y);
    if (legalX) this.position.x = x;
    const legalY = this.legal(this.position.x, y);
    if (legalY) this.position.y = y;
    this.avatar.setPosition(this.position.x, this.position.y);
    const avatarDepth = this.position.y + 35;
    this.avatar.setDepth(avatarDepth);
    if (this.direction) { const angle = Math.atan2(dy, dx) - Math.PI / 2; this.direction.setRotation(angle); this.direction.setPosition(dx / length * 51, dy / length * 51); }
  }
}

