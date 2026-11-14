import type { CSSProperties } from 'react';
import controls from '../../../../content/common/hud/battle-controls.webp';
import items from '../../../../content/common/lobby/shop-ui-icons.webp';
import skills from '../../../../content/common/lobby/shop-ui-skills.webp';
import { EquipmentIcon } from './equipment-icon';

type Symbol = 'dash' | 'block' | 'reward' | 'build' | 'bag' | 'safe' | 'schedule' | 'menu';
const symbols: Symbol[] = ['dash', 'block', 'reward', 'build', 'bag', 'safe', 'schedule', 'menu'];
const effects = ['stream', 'spring', 'ocean', 'cycle', 'slash', 'dual', 'spear', 'hammer', 'thunder-staff', 'blade', 'star', 'fireball', 'frost', 'thunder-seal', 'star-beam', 'chain-lightning', 'decay-curse', 'sword-array', 'binding-trap', 'banner-power', 'banner-tempo', 'banner-wind', 'banner-energy', 'banner-guard'];
const referenceEffects = ['fireball', 'blade', 'frost', 'chain-lightning', 'sword-array', 'binding-trap'];

export function HudIcon({ name, size }: { name: Symbol; size?: number }) {
  const index = symbols.indexOf(name); const row = Math.floor(index / 4);
  const style: CSSProperties = { display: 'inline-block', flexShrink: 0, width: size ?? '100%', height: size ?? '100%', backgroundImage: `url(${controls})`, backgroundSize: '400% 200%', backgroundPosition: `${index % 4 * 100 / 3}% ${row * 100}%` };
  return <span style={style} aria-hidden="true" />;
}

export function ItemIcon({ effect, size }: { effect?: string; size?: number }) {
  const value = effect ?? ''; const reference = referenceEffects.indexOf(value);
  const index = reference >= 0 ? reference : effects.indexOf(value);
  if (index < 0) return <EquipmentIcon kind="skill" effect={effect} size={size} />;
  const columns = reference >= 0 ? 3 : 8; const rows = reference >= 0 ? 2 : 5;
  const row = Math.floor(index / columns);
  const style: CSSProperties = { display: 'inline-block', flexShrink: 0, width: size ?? '100%', height: size ?? '100%', backgroundImage: `url(${reference >= 0 ? skills : items})`, backgroundSize: `${columns * 100}% ${rows * 100}%`, backgroundPosition: `${index % columns * 100 / (columns - 1)}% ${row * 100 / (rows - 1)}%` };
  return <span style={style} aria-hidden="true" />;
}
