import type { LootPickupData } from '@web-game-world/contracts';
import { lootColorCss, lootGrade } from '../game/loot-art';
import { displayNumber } from './display-number';

interface PickupText { name: string; detail: string; nameColor: string; detailColor: string; duration: number }
export interface PickupNotice extends PickupText { id: number; count: number; expires: number }

function recoveryText(amount: number | undefined, resource: string): string {
  if (amount === undefined) return `恢复${resource}`;
  if (amount === 0) return `${resource}已满`;
  const rounded = displayNumber(amount);
  return `${resource}+${rounded}`;
}

function pickupText(event: LootPickupData): PickupText {
  const item = event.item;
  const plain = '#f4eedf';
  if (item.category !== 'consumable') {
    const color = lootColorCss(item.level); const grade = lootGrade(item.level);
    return { name: item.name, detail: `Lv.${item.level}`, nameColor: color, detailColor: color, duration: grade >= 3 ? 2800 : 2200 };
  }
  if (item.effect === 'haste') return { name: '急速', detail: '移动速度+15%', nameColor: plain, detailColor: '#6bf2be', duration: 2200 };
  if (item.effect === 'focus') return { name: '聚灵', detail: '技能耗能−20%', nameColor: plain, detailColor: '#6de4ed', duration: 2200 };
  if (item.effect === 'shield') {
    const amount = event.grantedShield;
    const rounded = amount === undefined ? undefined : displayNumber(amount);
    const detail = rounded === undefined ? '伤害吸收' : `伤害吸收+${rounded}`;
    return { name: '护盾', detail, nameColor: plain, detailColor: '#ffd578', duration: 2200 };
  }
  if (!['life', 'energy', 'mana'].includes(item.effect)) return { name: item.name, detail: '已使用', nameColor: plain, detailColor: plain, duration: 2200 };
  const life = item.effect === 'life'; const resource = life ? '生命' : '灵力';
  const amount = life ? event.recoveredHp : event.recoveredEnergy;
  const detail = recoveryText(amount, resource);
  return { name: item.name, detail, nameColor: plain, detailColor: life ? '#83ee8e' : '#71caff', duration: 2200 };
}

export class PickupNoticeFeed {
  private visible: PickupNotice[] = [];
  private waiting: PickupNotice[] = [];
  private listeners = new Set<() => void>();
  private seen = new Set<string>();
  private room = '';
  private sequence = 0;
  private timer?: number;

  read = (): PickupNotice[] => this.visible;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  reset(room: string): void {
    this.clear();
    if (this.room !== room) { this.room = room; this.seen.clear(); }
  }
  receive(event: LootPickupData): void {
    if (this.seen.has(event.item.id)) return;
    this.seen.add(event.item.id);
    const text = pickupText(event);
    const now = Date.now();
    const entries = [...this.visible, ...this.waiting];
    const matching = entries.find(entry => (entry.expires === 0 || entry.expires - now > 320) && entry.name === text.name && entry.detail === text.detail && entry.nameColor === text.nameColor && entry.detailColor === text.detailColor);
    if (matching) matching.count += 1;
    else {
      this.sequence += 1;
      const notice = { ...text, id: this.sequence, count: 1, expires: 0 };
      this.waiting.push(notice);
    }
    this.advance();
  }
  private advance = (): void => {
    window.clearTimeout(this.timer);
    const now = Date.now();
    this.visible = this.visible.filter(entry => entry.expires > now);
    while (this.visible.length < 3 && this.waiting.length) {
      const notice = this.waiting.shift();
      if (!notice) break;
      notice.expires = now + notice.duration; this.visible.push(notice);
    }
    for (const listener of this.listeners) listener();
    if (!this.visible.length) { this.timer = undefined; return; }
    const expiry = this.visible.map(entry => entry.expires);
    const next = Math.min(...expiry) - now;
    this.timer = window.setTimeout(this.advance, next);
  };
  clear = (): void => {
    window.clearTimeout(this.timer); this.timer = undefined;
    this.waiting = []; this.visible = [];
    for (const listener of this.listeners) listener();
  };
}
