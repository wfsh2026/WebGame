import type Phaser from 'phaser';
import type { Effect } from '@web-game-world/simulation';
import type { BattleViewport } from './battle-entities';
import fontUrl from './assets/fonts/Kalam-Regular.ttf';

type Kind = 'normal' | 'heavy' | 'kill' | 'hurt' | 'absorb' | 'block';
interface Label { target: string; amount: number; count: number; kind: Kind; start: number; updated: number; x: number; y: number; lane: number; height: number; text: Phaser.GameObjects.Text; tag: Phaser.GameObjects.Text }
const colors: Record<Kind, string> = { normal: '#fff0ce', heavy: '#ffd881', kill: '#ffcf74', hurt: '#ff9a86', absorb: '#c4f5ff', block: '#c4f5ff' };
let fontReady = false;
let fontLoading: Promise<void> | undefined;
function loadFont(): void {
  if (fontLoading) return;
  const source = `url("${fontUrl}")`;
  const face = new FontFace('CombatHand', source);
  fontLoading = face.load().then(loaded => { document.fonts.add(loaded); fontReady = true; }).catch(() => { fontLoading = undefined; });
}

export class DamageLabels {
  private labels: Label[] = [];
  private serial = 0;
  private pool: { text: Phaser.GameObjects.Text; tag: Phaser.GameObjects.Text }[] = [];
  constructor(private scene: Phaser.Scene) { loadFont(); }

  add(effect: Effect, context: { mine: boolean; heavy: boolean; height: number }): void {
    const amount = effect.kind === 'absorb' ? effect.absorbed ?? 0 : effect.damage ?? 0;
    if (amount <= 0 && effect.kind !== 'block') return;
    const now = this.scene.time.now;
    const kind: Kind = effect.kind === 'absorb' ? 'absorb' : effect.kind === 'block' ? 'block' : context.mine ? 'hurt' : effect.killed ? 'kill' : context.heavy ? 'heavy' : 'normal';
    const offensive = kind === 'normal' || kind === 'heavy' || kind === 'kill';
    const existing = this.labels.find(label => label.target === effect.targetId && now - label.updated < 160 && now - label.start < 450 && (label.kind === kind || offensive && (label.kind === 'normal' || label.kind === 'heavy')));
    if (existing) {
      existing.amount += amount; existing.count += 1; existing.updated = now;
      if (kind === 'kill' || kind === 'heavy' && existing.kind === 'normal') existing.kind = kind;
      return;
    }
    if (this.labels.length >= 48) {
      const index = this.labels.findIndex(label => label.kind === 'normal' || label.kind === 'heavy');
      if (index < 0 && offensive && kind !== 'kill') return;
      const removed = this.labels.splice(index < 0 ? 0 : index, 1);
      for (const label of removed) this.release(label);
    }
    const style = { fontFamily: 'CombatHand, cursive', fontSize: '30px', color: colors[kind], stroke: '#58452f', strokeThickness: 1, padding: { x: 7, y: 5 }, shadow: { offsetX: 0, offsetY: 2, color: '#233525', blur: 4, fill: true, stroke: false } };
    const reused = this.pool.pop();
    const text = reused?.text ?? this.scene.add.text(0, 0, '', style);
    text.setVisible(true);
    text.setOrigin(.5); text.setDepth(12); text.setResolution(2);
    const tagStyle = { ...style, fontFamily: 'KaiTi, STKaiti, Microsoft YaHei, sans-serif', fontSize: '13px' };
    const tag = reused?.tag ?? this.scene.add.text(0, 0, '', tagStyle);
    tag.setOrigin(.5); tag.setDepth(12); tag.setResolution(2);
    const lane = this.serial++ % 3 - 1;
    const label = { target: effect.targetId ?? '', amount, count: 1, kind, start: now, updated: now, x: effect.x, y: effect.y, lane, height: context.height, text, tag };
    this.labels.push(label);
  }

  render(viewport: BattleViewport): void {
    const now = this.scene.time.now;
    const placed: { x: number; y: number; width: number }[] = [];
    this.labels = this.labels.filter(item => {
      const age = now - item.start; const pulseAge = now - item.updated;
      const lifetime = item.kind === 'kill' ? 1100 : item.kind === 'hurt' ? 800 : 950;
      const remaining = Math.max(lifetime - age, 380 - pulseAge);
      if (remaining <= 0) { this.release(item); return false; }
      const size = item.kind === 'kill' ? 38 : item.kind === 'heavy' ? 36 : item.kind === 'hurt' ? 30 : 28;
      const value = Math.round(item.amount); const amount = item.amount > 0 && value === 0 ? '<1' : String(value);
      const label = item.kind === 'hurt' ? `−${amount}` : amount;
      const tag = item.kind === 'kill' ? '击破' : item.kind === 'absorb' ? '吸收' : item.kind === 'block' ? '格挡' : item.count > 1 ? `${item.count}次` : '';
      const family = fontReady ? 'CombatHand' : 'cursive';
      if (item.text.style.fontFamily !== family) item.text.setFontFamily(family);
      if (item.text.style.fontSize !== `${size}px`) item.text.setFontSize(size);
      const color = colors[item.kind];
      if (item.text.style.color !== color) item.text.setColor(color);
      if (item.tag.style.color !== color) item.tag.setColor(color);
      if (item.text.text !== label) item.text.setText(label);
      if (item.tag.text !== tag) item.tag.setText(tag);
      const progress = Math.min(1, pulseAge / 180);
      const scale = 1 + Math.sin(progress * Math.PI) * (item.kind === 'heavy' || item.kind === 'kill' ? .24 : .15);
      const drift = Math.max(0, age - 230) * .032;
      const halfWidth = item.text.width * scale / 2 + 8;
      const rawX = viewport.ox + item.x * viewport.unit + item.lane * (12 + drift * .22);
      const right = Math.max(halfWidth, this.scene.scale.width - halfWidth);
      const boundedX = Math.min(right, rawX); const x = Math.max(halfWidth, boundedX);
      let y = viewport.oy + item.y * viewport.unit - item.height * viewport.unit - 30 - drift;
      for (const other of placed) {
        if (Math.abs(other.x - x) < (other.width + item.text.width) / 2 && Math.abs(other.y - y) < 42) y = other.y - 42;
      }
      y = Math.max(24, y);
      placed.push({ x, y, width: item.text.width });
      const alpha = Math.min(1, remaining / 240);
      item.text.setPosition(x, y); item.text.setAlpha(alpha); item.text.setScale(scale);
      item.tag.setPosition(x, y + size * .55 + 6); item.tag.setAlpha(alpha); item.tag.setVisible(Boolean(tag));
      return true;
    });
  }

  private release(label: Label): void {
    label.text.setVisible(false); label.tag.setVisible(false);
    const pair = { text: label.text, tag: label.tag }; this.pool.push(pair);
  }

  reset(): void {
    for (const label of this.labels) this.release(label);
    this.labels = []; this.serial = 0;
  }
}
