import bannerAtlas from '../../../../content/packs/forest-survival/assets/battle-banners.webp';
import novelAtlas from '../../../../content/packs/forest-survival/assets/novel-skills.webp';
import type { CSSProperties } from 'react';
import resonanceAtlas from '../../../../content/packs/forest-survival/assets/runtime/resonance-atlas.webp';
import atlas from '../../../../content/packs/forest-survival/assets/runtime/ability-atlas.webp';
export function EquipmentIcon({ kind, effect, size = 48 }: { kind: string; effect?: string; size?: number }) {
  const bannerCells: Record<string, number> = { 'banner-power': 1, 'banner-tempo': 5, 'banner-wind': 9, 'banner-energy': 13, 'banner-guard': 17, duration: 14, linger: 11, twin: 9, concentrate: 2 };
  const banner = bannerCells[effect ?? ''];
  if (banner !== undefined) {
    const x = banner % 4 * 100 / 3; const row = Math.floor(banner / 4); const y = row * 25;
    const style: CSSProperties = { display: 'inline-block', width: size, height: size, flexShrink: 0, backgroundImage: `url(${bannerAtlas})`, backgroundSize: '400% 500%', backgroundPosition: `${x}% ${y}%` };
    return <span style={style} aria-hidden="true" />;
  }
  const novelCells: Record<string, number> = { 'star-beam': 2, 'chain-lightning': 6, 'decay-curse': 10, 'sword-array': 14, 'binding-trap': 18 };
  const novel = novelCells[effect ?? ''];
  if (novel !== undefined) {
    const x = novel % 4 * 100 / 3; const row = Math.floor(novel / 4); const y = row * 25;
    const style: CSSProperties = { display: 'inline-block', width: size, height: size, flexShrink: 0, backgroundImage: `url(${novelAtlas})`, backgroundSize: '400% 500%', backgroundPosition: `${x}% ${y}%` };
    return <span style={style} aria-hidden="true" />;
  }
  const cells: Record<string, number> = { slash: 0, dual: 1, spear: 2, hammer: 3, blade: 4, star: 5, fireball: 6, frost: 7 };
  const resonanceCells: Record<string, number> = { 'thunder-seal': 0, 'thunder-staff': 2, cycle: 6, resonance: 7 };
  const special = resonanceCells[effect ?? ''];
  const index = special ?? cells[effect ?? ''] ?? (kind === 'heart' ? 12 : kind === 'skill' ? 14 : 15);
  const x = index % 4 * 100 / 3; const y = Math.floor(index / 4) * 100 / (special === undefined ? 3 : 1);
  const style: CSSProperties = { display: 'inline-block', width: size, height: size, flexShrink: 0, backgroundImage: `url(${special === undefined ? atlas : resonanceAtlas})`, backgroundSize: special === undefined ? '400% 400%' : '400% 200%', backgroundPosition: `${x}% ${y}%` };
  return <span style={style} aria-hidden="true" />;
}
