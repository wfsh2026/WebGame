import { abilityDemand } from '@web-game-world/simulation';
import { AttackRhythm } from './attack-rhythm';
import { displayNumber as number, equipmentDescription } from '../hud/display-number';
import { useEffect, useState } from 'react';
import type { BuildStateData, EquipmentLoadoutData, PlayerView } from '@web-game-world/contracts';
import { abilityGrowthRoute, abilityGrowthSummary, buildCatalog, equippedIds, equipmentRuntime, fitLoadout, supportCompatible } from '@web-game-world/simulation';
import type { EquipmentItem } from '@web-game-world/simulation';
import content from '../network/content';
import { EquipmentIcon } from '../hud/equipment-icon';
import c from '../lobby/camp/skill-constellation.module.css';
import s from './skill-panel.module.css';

type Target = { kind: 'heart' | 'ability' | 'support'; branch: number; socket: number };
type Filter = 'all' | 'new' | EquipmentItem['kind'];
interface Props { state: BuildStateData; player?: PlayerView; focus?: string; unseen: string[]; viewed: (id: string) => void; discard: (id: string) => void; equip: (loadout: EquipmentLoadoutData, revision: number) => void }
const names = { heart: '心法', weapon: '近战武器', skill: '远程技能', support: '辅助宝石' };
const filters: { id: Filter; name: string }[] = [{ id: 'all', name: '全部' }, { id: 'new', name: '新获得' }, { id: 'heart', name: '心法' }, { id: 'weapon', name: '武器' }, { id: 'skill', name: '技能' }, { id: 'support', name: '辅助' }];
function location(angle: number, radius: number) { const radians = angle * Math.PI / 180; return { left: `${50 + Math.cos(radians) * radius}%`, top: `${50 + Math.sin(radians) * radius}%` }; }
function level(item: EquipmentItem) { return `有效 Lv.${item.level} = 物品 ${item.baseLevel ?? 1} + 本局 ${(item.level ?? 1) - (item.baseLevel ?? 1)} · 修习 ${item.experience ?? 0}`; }
export function SkillPanel(props: Props) {
  const [draft, setDraft] = useState(props.state.loadout);
  const [target, setTarget] = useState<Target>({ kind: 'heart', branch: 0, socket: 0 });
  const [selected, setSelected] = useState(props.focus ?? '');
  const [filter, setFilter] = useState<Filter>(props.unseen.length ? 'new' : 'all');
  const [query, setQuery] = useState('');
  const [compatibleOnly, setCompatibleOnly] = useState(false);
  const [openedNew] = useState(props.unseen);
  const catalog = buildCatalog(content, props.state.items);
  const occupied = equippedIds(draft);
  const heart = catalog.find(item => item.id === draft.heart);
  const candidate = catalog.find(item => item.id === selected);
  useEffect(() => { setDraft(props.state.loadout); }, [props.state.loadout]);
  const targets: Target[] = [{ kind: 'heart', branch: 0, socket: 0 }];
  draft.slots.forEach((slot, branch) => {
    targets.push({ kind: 'ability', branch, socket: 0 });
    slot?.supports.forEach((_, socket) => targets.push({ kind: 'support', branch, socket }));
  });
  function itemAt(place: Target) {
    const slot = draft.slots[place.branch];
    const id = place.kind === 'heart' ? draft.heart : place.kind === 'ability' ? slot?.itemId : slot?.supports[place.socket];
    return catalog.find(item => item.id === id);
  }
  function reason(item: EquipmentItem, place: Target): string {
    const current = itemAt(place);
    if (occupied.includes(item.id) && current?.id !== item.id) return '已装在其他槽位，请先卸下';
    if (place.kind === 'heart') return item.kind === 'heart' ? '' : '请选择对应的能力或辅助槽';
    if (place.branch >= draft.slots.length) return '能力槽尚未解锁';
    if (place.kind === 'ability') return item.kind === 'weapon' || item.kind === 'skill' ? '' : '该槽只能装配武器或技能';
    const slot = draft.slots[place.branch]; const ability = catalog.find(entry => entry.id === slot?.itemId);
    if (!slot || !ability || place.socket >= slot.supports.length) return '请先装配能力并解锁辅助槽';
    if (item.kind !== 'support' || !supportCompatible(item, ability)) return '与所属能力不兼容';
    const duplicate = slot.supports.some((id, index) => {
      const other = catalog.find(entry => entry.id === id);
      return index !== place.socket && other && (other.definitionId ?? other.id) === (item.definitionId ?? item.id);
    });
    return duplicate ? '同一能力不能装配同名辅助' : '';
  }
  function pick(item: EquipmentItem): void {
    setSelected(item.id); props.viewed(item.id);

  }
  useEffect(() => { const item = catalog.find(entry => entry.id === props.focus); if (item) pick(item); }, [props.focus]);
  function chooseTarget(place: Target): void {
    setTarget(place);
    if (!candidate || reason(candidate, place)) { setSelected(''); setCompatibleOnly(true); setFilter('all'); }
  }
  function proposal(id: string | null, place: Target = target): EquipmentLoadoutData {
    const slots = draft.slots.map(slot => slot ? { ...slot, supports: [...slot.supports] } : null);
    let heart = draft.heart;
    if (place.kind === 'heart') heart = id;
    else if (place.kind === 'ability') slots[place.branch] = id ? { itemId: id, supports: slots[place.branch]?.supports ?? [] } : null;
    else { const slot = slots[place.branch]; if (slot) slot.supports[place.socket] = id; }
    const next = { heart, slots }; return fitLoadout(next, catalog);
  }
  function unequip(place: Target): void {
    if (!itemAt(place)) return;
    const next = proposal(null, place); commit(next); setSelected('');
  }
  function quickEquip(item: EquipmentItem): void {
    if (reason(item, target) || itemAt(target)?.id === item.id) return;
    const next = proposal(item.id); commit(next);
  }
  function commit(next: EquipmentLoadoutData): void { setDraft(next); props.equip(next, props.state.revision); }
  function power(loadout: EquipmentLoadoutData) {
    const runtime = equipmentRuntime(loadout, content, props.state.items);
    const heart = runtime.heartItem; const supply = heart ? heart.recovery / heart.interval : 0;
    let demand = 0;
    for (const branch of runtime.branches) {
      const speed = branch.item.kind === 'weapon' ? props.player?.stats?.attackSpeed ?? 1 : props.player?.stats?.castingSpeed ?? 1;
      demand += abilityDemand(branch, speed);
    }
    return { supply, demand, runtime };
  }
  function facts(item: EquipmentItem | undefined): [string, string][] {
    if (!item) return [];
    if (item.kind === 'heart') return [['能力槽', `${item.slots}`], ['灵力容量', number(item.capacity)], ['平均供给 / 秒', number(item.recovery / item.interval)], ['每次恢复魔法消耗', number(item.manaCost)]];
    if (item.kind === 'support') return [['伤害倍率', `×${number(item.damageMultiplier)}`], ['耗能倍率', `×${number(item.costMultiplier)}`], ['投射物数量', `${item.projectiles ?? 1}`]];
    return [['基础伤害系数', `${number((item.coefficient ?? 0) * 100)}%`], ['基础间隔 / 秒', number(item.interval)], ['单次耗能', number(item.cost)], ['辅助槽', `${item.supportSlots}`], ['攻击距离', number(item.range ?? 0)]];
  }
  const current = itemAt(target);
  const blocked = candidate ? reason(candidate, target) : '';
  const next = candidate && !blocked ? proposal(candidate.id) : draft;
  const retained = equippedIds(next);
  const returned = catalog.filter(item => occupied.includes(item.id) && !retained.includes(item.id));
  const before = power(draft); const after = power(next);
  const beforeId = draft.slots[target.branch]?.itemId; const afterId = next.slots[target.branch]?.itemId;
  const branchBefore = before.runtime.branches.find(branch => branch.item.id === beforeId); const branchAfter = after.runtime.branches.find(branch => branch.item.id === afterId);
  const candidateRoute = candidate ? abilityGrowthRoute(candidate) : [];
  const currentGrowth = current ? abilityGrowthSummary(current) : ''; const candidateGrowth = candidate ? abilityGrowthSummary(candidate) : '';
  const currentFacts = facts(current); const nextFacts = facts(candidate);
  const search = query.trim().toLocaleLowerCase();
  const filtered = catalog.filter(item => {
    const isNew = props.unseen.includes(item.id) || openedNew.includes(item.id);
    return (filter === 'all' || filter === 'new' && isNew || item.kind === filter) && item.name.toLocaleLowerCase().includes(search) && (!compatibleOnly || !reason(item, target));
  });
  filtered.sort((a, b) => {
    const levels = (b.level ?? 1) - (a.level ?? 1);
    const aNew = props.unseen.includes(a.id); const bNew = props.unseen.includes(b.id);
    const freshness = Number(bNew) - Number(aNew);
    const aIndex = catalog.indexOf(a); const bIndex = catalog.indexOf(b);
    return levels || freshness || bIndex - aIndex;
  });
  function node(place: Target, angle: number, radius: number) {
    const item = itemAt(place); const style = location(angle, radius);
    const active = place.kind === target.kind && place.branch === target.branch && place.socket === target.socket;
    const eligible = candidate && !reason(candidate, place);
    const label = place.kind === 'heart' ? '心法' : place.kind === 'ability' ? `能力 ${place.branch + 1}` : `辅助 ${place.socket + 1}`;
    const kind = place.kind === 'heart' ? c.heartNode : place.kind === 'ability' ? c.ability : c.socket;
    const className = `${kind} ${s.node}`;
    return <button key={`${place.kind}-${place.branch}-${place.socket}`} className={className} style={style} aria-pressed={active} data-eligible={Boolean(eligible)} onClick={() => chooseTarget(place)} onDoubleClick={() => unequip(place)} title={`${label}：${item?.name ?? '空槽'}${item ? ' · 双击卸下' : ''}${eligible ? ' · 可装配选中物品' : ''}`}><span className={c.emblem}>{item ? <EquipmentIcon kind={item.kind} effect={item.effect} size={42} /> : '+'}</span><span className={s.nodeLabel}>{item?.name ?? label}</span><small>{item ? `Lv.${item.level}` : '空槽'}</small></button>;
  }
  const heartNode = node({ kind: 'heart', branch: 0, socket: 0 }, 0, 0);
  return <section className={s.panel}><h2>本局构筑</h2><AttackRhythm runtime={before.runtime} attackSpeed={props.player?.stats?.attackSpeed ?? 1} castingSpeed={props.player?.stats?.castingSpeed ?? 1} /><details className={s.note}><summary>合成与成长规则</summary><p>自动合成：本局获得的同种、同物品等级储备，3 件合成高 1 级，可连续合成。已装备、临时强化及待选升级绑定物品不参与；所有构筑物品最高20级；心法和能力在5/10/15/20级开槽。10级后成长奖励改为100修习经验，换下保留进度。</p></details><p>先点击需要装配的槽位，再双击右侧物品装备或替换；双击已装备槽位可卸下，单击可查看对比。</p><div className={s.layout}>
    <div className={`${c.cosmos} ${s.constellation}`}><div className={`${c.board} ${s.board}`}>
      <svg className={c.orbits} viewBox="0 0 1000 1000" fill="none" aria-hidden="true"><circle cx="500" cy="500" r="430" /><circle cx="500" cy="500" r="290" />{[-90, -18, 54, 126, 198].map(angle => { const rad = angle * Math.PI / 180; const x = 500 + Math.cos(rad) * 290; const y = 500 + Math.sin(rad) * 290; return <g key={angle}><line x1="500" y1="500" x2={x} y2={y} />{[-24, -12, 0, 12, 24].map(offset => { const end = (angle + offset) * Math.PI / 180; return <line key={offset} x1={x} y1={y} x2={500 + Math.cos(end) * 430} y2={500 + Math.sin(end) * 430} />; })}</g>; })}</svg>
      {heartNode}{[-90, -18, 54, 126, 198].map((angle, index) => {
        const slot = draft.slots[index]; const item = catalog.find(entry => entry.id === slot?.itemId);
        const place: Target = { kind: 'ability', branch: index, socket: 0 };
        if (index >= draft.slots.length) { const style = location(angle, 29); const message = !heart ? '先装备心法' : `心法 ${index * 5} 级解锁`; return <button key={index} className={`${c.ability} ${c.locked} ${s.node}`} style={style} disabled title={message}><span>锁</span><small>{message}</small></button>; }
        const abilityNode = node(place, angle, 29);
        return <div key={index}>{abilityNode}{[-24, -12, 0, 12, 24].map((offset, socket) => {
          if (!item) return null;
          const support: Target = { kind: 'support', branch: index, socket };
          if (socket < (slot?.supports.length ?? 0)) return node(support, angle + offset, 43);
          const style = location(angle + offset, 43); const message = `${item.name} ${socket * 5} 级解锁辅助槽`;
          return <button key={socket} className={`${c.socket} ${c.locked} ${s.node}`} style={style} disabled title={message} aria-label={message}>锁<small>{socket * 5}级</small></button>;
        })}</div>;
      })}</div><p className={s.power}>灵力供给 {number(before.supply)}/秒 · 满速需求 {number(before.demand)}/秒</p><p className={s.note}>实线关联所属能力与心法；选中物品后，高亮可装位置。锁定槽位悬停查看解锁等级。</p></div>
    <div className={s.inventory}><nav aria-label="构筑物品分类">{filters.map(entry => <button key={entry.id} aria-pressed={filter === entry.id} onClick={() => setFilter(entry.id)}>{entry.name}{entry.id === 'new' ? ` ${props.unseen.length}` : ''}</button>)}</nav><input aria-label="搜索本局物品" placeholder="搜索物品名称 · 等级从高到低" value={query} onChange={event => setQuery(event.target.value)} /><label className={s.filter}><input type="checkbox" checked={compatibleOnly} onChange={event => setCompatibleOnly(event.target.checked)} />仅看当前槽位可装物品</label><div className={s.items}>{filtered.map(item => {
      const equipped = occupied.includes(item.id); const available = targets.some(place => !reason(item, place));
      return <button className={s.item} key={item.id} aria-pressed={selected === item.id} onClick={() => pick(item)} onDoubleClick={() => quickEquip(item)}><EquipmentIcon kind={item.kind} effect={item.effect} size={44} /><b>{item.name}</b><span>{names[item.kind]} · Lv.{item.level}</span><span>{item.kind === 'heart' ? `${item.slots} 个能力槽 · 供给 ${number(item.recovery / item.interval)}/秒` : item.kind === 'support' ? item.description : `${item.supportSlots} 个辅助槽 · 耗能 ${number(item.cost)}`}</span><small>{props.unseen.includes(item.id) ? '新获得 · ' : ''}{equipped ? '已装备' : available ? '可装配' : '暂不可装'}</small></button>;
    })}</div>{!filtered.length && <p>暂无符合条件的物品，可切换分类或取消兼容筛选。</p>}</div>
  </div><section className={s.comparison} aria-label="装备替换对比"><h3>{target.kind === 'heart' ? '心法' : `能力 ${target.branch + 1}${target.kind === 'support' ? ` · 辅助 ${target.socket + 1}` : ''}`} · 装配对比</h3>
    <div className={s.compareColumns}><article><small>当前装备</small><h3>{current?.name ?? '空槽'}</h3>{current && <><p>{level(current)}</p><p>{equipmentDescription(current)}</p><strong>{currentGrowth}</strong></>}</article><article><small>选中物品</small><h3>{candidate?.name ?? '请选择右侧物品'}</h3>{candidate && <><p>{level(candidate)}</p><p>{equipmentDescription(candidate)}</p><strong>{candidateGrowth}</strong><details><summary>完整成长路线</summary>{candidateRoute.map(entry => <p key={entry}>{entry}</p>)}</details></>}</article></div>
    {candidate && <><div className={s.facts}>{nextFacts.map(([label, value]) => { const old = currentFacts.find(entry => entry[0] === label)?.[1] ?? '—'; return <div key={label}><span>{label}</span><span>{old} → <b>{value}</b></span></div>; })}</div>
      {!blocked && <><p>整体供给：{number(before.supply)} → {number(after.supply)}/秒　满速需求：{number(before.demand)} → {number(after.demand)}/秒</p>{target.kind === 'support' && branchAfter && <p>所属能力 {branchAfter.item.name}：单次耗能 {number((branchBefore?.item.cost ?? 0) * (branchBefore?.costMultiplier ?? 1))} → {number(branchAfter.item.cost * branchAfter.costMultiplier)}；伤害倍率 {number(branchBefore?.damageMultiplier ?? 1)} → {number(branchAfter.damageMultiplier)}；间隔 {number((branchBefore?.item.interval ?? 0) * (branchBefore?.intervalMultiplier ?? 1))} → {number(branchAfter.item.interval * branchAfter.intervalMultiplier)} 秒（基础速度）</p>}{after.demand > after.supply && <p className={s.warning}>供能不足时攻击需要等待灵力恢复，仍可装配。</p>}{returned.length > 0 && <p>替换后退回储备：{returned.map(item => item.name).join('、')}。临时强化保留。</p>}</>}
      {blocked && <p className={s.warning}>{blocked}。可点击构筑图的高亮位置。</p>}<button className={s.primary} disabled={Boolean(blocked) || current?.id === candidate.id} onClick={() => commit(next)}>{current?.id === candidate.id ? '已装备' : current ? '确认替换' : '装配到选中槽位'}</button></>}
    {candidate && !occupied.includes(candidate.id) && <button onClick={() => { props.discard(candidate.id); setSelected(''); }}>丢弃选中物品</button>}
    {current && <button onClick={() => { const next = proposal(null); commit(next); }}>卸下{current.name}到储备</button>}
  </section><p className={s.note}>仅影响本局。换装不补充资源、不重置攻击计时；溢出或不兼容的物品退回储备。条件恢复另计，平均供需不保证实际触发频率。</p></section>;
}
