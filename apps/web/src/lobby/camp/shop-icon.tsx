import type { CSSProperties } from 'react';
import type { EquipmentItem } from '@web-game-world/simulation';
import icons from '../../../../../content/common/lobby/shop-ui-icons.webp';
import referenceSkills from '../../../../../content/common/lobby/shop-ui-skills.webp';

const definitions = ['heart/stream', 'heart/spring', 'heart/ocean', 'heart/cycle', 'skill/longblade', 'skill/dual-blades', 'skill/spear', 'skill/hammer', 'skill/thunder-staff', 'skill/flying-blade', 'skill/star', 'skill/fireball', 'skill/frost', 'skill/thunder-seal', 'skill/star-beam', 'skill/chain-lightning', 'skill/decay-curse', 'skill/sword-array', 'skill/binding-trap', 'skill/banner-power', 'skill/banner-tempo', 'skill/banner-wind', 'skill/banner-energy', 'skill/banner-guard', 'support/economy', 'support/overload', 'support/haste', 'support/area', 'support/multiple-projectiles', 'support/knockback', 'support/resonance', 'support/fork', 'support/unleash', 'support/aftershock', 'support/execution-spread', 'support/duration', 'support/linger', 'support/twin', 'support/concentrate', 'support/homing'];
const referenceEffects = ['fireball', 'blade', 'frost', 'chain-lightning', 'sword-array', 'binding-trap'];

export function ShopIcon(props: { item: EquipmentItem; size?: number }) {
  const referenceIndex = props.item.kind === 'skill' ? referenceEffects.indexOf(props.item.effect ?? '') : -1;
  const definition = props.item.id.split(':')[1];
  const definitionIndex = definitions.indexOf(definition);
  const index = referenceIndex >= 0 ? referenceIndex : definitionIndex;
  if (index < 0) return null;
  const columns = referenceIndex >= 0 ? 3 : 8; const rows = referenceIndex >= 0 ? 2 : 5;
  const row = Math.floor(index / columns);
  const x = index % columns * 100 / (columns - 1); const y = row * 100 / (rows - 1);
  const size = props.size ?? 88;
  const style: CSSProperties = { display: 'inline-block', flexShrink: 0, width: size, height: size, backgroundImage: `url(${referenceIndex >= 0 ? referenceSkills : icons})`, backgroundSize: `${columns * 100}% ${rows * 100}%`, backgroundPosition: `${x}% ${y}%` };
  return <span style={style} aria-hidden="true" />;
}
