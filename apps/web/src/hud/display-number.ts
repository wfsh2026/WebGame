import type { EquipmentItem } from '@web-game-world/simulation';
import { homingStats, supportProgress } from '@web-game-world/simulation';

export function displayNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

export function equipmentDescription(item: EquipmentItem): string {
  const description = item.description ?? '';
  if (item.kind !== 'support') return description;
  const progress = supportProgress(item.level ?? 1);
  const damage = displayNumber(item.damageMultiplier);
  const cost = displayNumber(item.costMultiplier);
  let extra = '';
  if (item.effect === 'haste') { const interval = displayNumber(.9 - .15 * progress); extra = ` · 间隔 ×${interval}`; }
  if (item.effect === 'area') { const area = displayNumber(1.15 + .2 * progress); extra = ` · 范围 ×${area}`; }
  if (item.effect === 'concentrate') { const area = displayNumber(.75 - .05 * progress); extra = ` · 范围 ×${area}`; }
  if (item.effect === 'duration') { const duration = displayNumber(1.3 + .3 * progress); extra = ` · 战旗持续 ×${duration}`; }
  if (item.effect === 'linger') { const linger = displayNumber(1.5 + 1.5 * progress); extra = ` · 离阵额外 ${linger}秒`; }
  if (item.effect === 'knockback') { const distance = displayNumber(.25 + .25 * progress); extra = ` · 追加击退 ${distance}米`; }
  if (item.effect === 'resonance') { const bonus = displayNumber(15 + 15 * progress); extra = ` · 共鸣增幅 ${bonus}%`; }
  if (item.effect === 'homing') {
    const settings = homingStats(item.level ?? 1);
    const range = displayNumber(settings.range); const turning = displayNumber(settings.turnDegrees);
    extra = ` · 索敌半径 ${range}米 · 转向 ${turning}度/秒`;
  }
  if (item.effect === 'multiple') extra = ` · 投射物 ${item.projectiles ?? 1}枚`;
  return `当前等级：伤害／增益 ×${damage} · 耗能 ×${cost}${extra}。机制与初始效果：${description}`;
}
