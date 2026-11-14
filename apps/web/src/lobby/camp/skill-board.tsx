import { abilitySlotLevels, activationSlotLevels, characterSlots, supportCompatible } from '@web-game-world/simulation';
import type { EquipmentItem } from '@web-game-world/simulation';
import type { EquipmentLoadoutData } from '@web-game-world/contracts';
import { ShopIcon } from './shop-icon';
import s from './skill-loadout.module.css';

export interface SkillSelection { kind: 'heart' | 'ability' | 'support'; branch: number; socket: number }
interface Props { loadout?: EquipmentLoadoutData; catalog: EquipmentItem[]; characterLevel: number; selection: SkillSelection; busy: boolean; teaching?: SkillSelection['kind']; choose: (target: SkillSelection) => void }
const angles = [-90, -18, -162, 126, 54];

function point(angle: number, radius: number) {
  const radians = angle * Math.PI / 180;
  return { x: 50 + Math.cos(radians) * radius, y: 51 + Math.sin(radians) * radius };
}

export function SkillArt({ item }: { item: EquipmentItem }) {
  const definition = { ...item, id: item.definitionId || item.id };
  return <span className={s.art}><ShopIcon item={definition} size={128} /></span>;
}

export function SkillBoard(props: Props) {
  const capacity = characterSlots(props.characterLevel);
  const heart = props.catalog.find(item => item.id === props.loadout?.heart);
  const selectedHeart = props.selection.kind === 'heart';
  const heartTarget: SkillSelection = { kind: 'heart', branch: 0, socket: 0 };
  const lines = [];
  const nodes = angles.map((angle, index) => {
    const location = point(angle, 29);
    const slot = props.loadout?.slots[index];
    const item = props.catalog.find(entry => entry.id === slot?.itemId);
    const locked = index >= capacity.abilities;
    const active = Boolean(heart && index < heart.slots);
    const selected = props.selection.kind !== 'heart' && props.selection.branch === index;
    const target: SkillSelection = { kind: 'ability', branch: index, socket: 0 };
    const label = locked ? `角色${abilitySlotLevels[index]}级解锁` : item ? `${item.name} Lv.${item.level ?? 1}` : '装配技能';
    const status = item && !active ? `已预装 · 心法${activationSlotLevels[index]}级激活` : '';
    const style = { left: `${location.x}%`, top: `${location.y}%` };
    const lowerClass = index >= 3 && item ? `${s.lowerNode} ${index === 4 ? s.rightLower : ''}` : '';
    if (!locked) lines.push(<line key={`ability-${index}`} x1="50" y1="51" x2={location.x} y2={location.y} className={active ? s.activeLine : s.dormantLine} />);
    const supports = item ? Array.from({ length: capacity.supports }, (_, socket) => {
      const id = slot?.supports[socket];
      const support = props.catalog.find(entry => entry.id === id);
      const compatible = support ? supportCompatible(support, item) : true;
      const enabled = active && socket < item.supportSlots && compatible;
      const offset = (socket - (capacity.supports - 1) / 2) * 12;
      const gem = point(angle + offset, 43);
      const gemStyle = { left: `${gem.x}%`, top: `${gem.y}%` };
      const gemTarget: SkillSelection = { kind: 'support', branch: index, socket };
      const gemSelected = selected && props.selection.kind === 'support' && props.selection.socket === socket;
      const required = Math.max(activationSlotLevels[socket], compatible ? 1 : 5);
      const reason = !active ? `心法${activationSlotLevels[index]}级激活` : `技能${required}级激活`;
      const gemLabel = `${item.name} · 辅助槽${socket + 1} · ${support?.name ?? '空槽'} · ${enabled ? '已激活' : reason}`;
      lines.push(<line key={`support-${index}-${socket}`} x1={location.x} y1={location.y} x2={gem.x} y2={gem.y} className={enabled ? s.activeLine : s.dormantLine} />);
      return <button key={socket} type="button" className={`${s.gemNode} ${enabled ? '' : s.dormant} ${gemSelected ? s.selected : ''} ${props.teaching === 'support' && index === 0 && socket === 0 ? s.teaching : ''}`} style={gemStyle} disabled={props.busy} aria-pressed={gemSelected} aria-label={gemLabel} title={gemLabel} onClick={() => props.choose(gemTarget)}>{support ? <SkillArt item={support} /> : <span className={s.plus}>+</span>}</button>;
    }) : null;
    return <div key={index}><button type="button" className={`${s.skillNode} ${lowerClass} ${locked ? s.locked : ''} ${item && !active ? s.dormant : ''} ${selected ? s.selected : ''} ${props.teaching === 'ability' && index === 0 ? s.teaching : ''}`} style={style} disabled={props.busy || locked} aria-pressed={selected} aria-label={`${label}${status ? ` · ${status}` : ''}`} title={status || label} onClick={() => props.choose(target)}>{item ? <SkillArt item={item} /> : !locked && <span className={s.plus}>+</span>}<span className={s.nodeLabel}>{label}</span>{status && <small className={s.nodeStatus}>{status}</small>}</button>{supports}</div>;
  });
  return <div className={s.board} aria-label="心法与技能连接图"><div className={s.engraving} /><svg className={s.connections} viewBox="0 0 100 100" fill="none" aria-hidden="true">{lines}</svg>{nodes}<button type="button" className={`${s.heartNode} ${selectedHeart ? s.selected : ''} ${props.teaching === 'heart' ? s.teaching : ''}`} disabled={props.busy} aria-pressed={selectedHeart} aria-label={heart ? `${heart.name} · 查看心法` : '空心法槽 · 装配心法'} onClick={() => props.choose(heartTarget)}>{heart ? <SkillArt item={heart} /> : <span className={s.plus}>+</span>}<span className={s.nodeLabel}>{heart?.name ?? '装配心法'}</span>{heart && <small className={s.heartLevel}>Lv.{heart.level ?? 1}</small>}</button></div>;
}
