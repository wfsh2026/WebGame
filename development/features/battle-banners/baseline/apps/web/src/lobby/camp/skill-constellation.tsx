import { abilityDemand } from '@web-game-world/simulation';
import { AttackRhythm } from '../../online/attack-rhythm';
import { displayNumber as number, equipmentDescription } from '../../hud/display-number';
import { EquipmentIcon } from '../../hud/equipment-icon';
import { useEffect, useRef, useState } from 'react';
import { abilityGrowthRoute, abilityGrowthSummary, equipmentCatalog, buildCatalog, equippedIds, equipmentError, supportCompatible, equipmentRuntime } from '@web-game-world/simulation';
import type { EquipmentItem } from '@web-game-world/simulation';
import type { EquipmentStateData, EquipmentLoadoutData } from '@web-game-world/contracts';
import type { LobbyViewProps } from '../../online/lobby-view';
import manifest from '../../network/content';
import s from './skill-constellation.module.css';

interface ConstellationProps { attackSpeed: number; castingSpeed: number; maxMp: number; loadEquipment: LobbyViewProps['loadEquipment']; saveEquipment: LobbyViewProps['saveEquipment']; onBusyChange: (busy: boolean) => void }
interface Point { x: number; y: number }
interface Selection { kind: 'heart' | 'ability' | 'support'; branch: number; socket: number }
type SymbolKind = 'heart' | 'bow' | 'nova' | 'gem' | 'lock' | 'plus';
const baseCatalog = equipmentCatalog(manifest);
const kindNames = { heart: '心法', weapon: '武器', skill: '技能', support: '辅助' };

function position(angle: number, radius: number): Point {
  const radians = angle * Math.PI / 180;
  const x = 500 + Math.cos(radians) * radius;
  const y = 500 + Math.sin(radians) * radius;
  return { x, y };
}
function symbolFor(item?: EquipmentItem): SymbolKind {
  if (!item) return 'plus';
  return item.kind === 'heart' ? 'heart' : item.kind === 'weapon' ? 'bow' : item.kind === 'skill' ? 'nova' : 'gem';
}
function errorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.name === 'TimeoutError') return '保存响应超时，请刷新装配状态后继续。';
  if (cause instanceof Error && cause.name === 'ZodError') return '装配数据格式不兼容，请更新客户端与服务端后重试。';
  if (cause instanceof TypeError || cause instanceof SyntaxError) return '暂时无法连接装备服务，请刷新后重试。';
  return cause instanceof Error ? cause.message : '装配操作失败，请刷新后重试。';
}

function Emblem(props: { kind: SymbolKind; effect?: string }) {
  if (props.kind === 'plus' || props.kind === 'lock') return <span className={s.emblem} aria-hidden="true">{props.kind === 'plus' ? '+' : '锁'}</span>;
  const kind = props.kind === 'bow' ? 'weapon' : props.kind === 'nova' ? 'skill' : props.kind === 'heart' ? 'heart' : 'support';
  return <span className={s.emblem} aria-hidden="true"><EquipmentIcon kind={kind} effect={props.effect} /></span>;
}


export function SkillConstellation(props: ConstellationProps) {
  const [state, setState] = useState<EquipmentStateData | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [notice, setNotice] = useState('');
  const popup = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const pending = useRef(false);
  const loadout = state?.loadout;
  const catalog = state ? buildCatalog(manifest, state.items) : baseCatalog;
  const heart = catalog.find(item => item.id === loadout?.heart);
  const slots = loadout?.slots ?? [];
  const occupied = loadout ? equippedIds(loadout) : [];
  const branch = selection ? slots[selection.branch] : null;
  const ability = catalog.find(item => item.id === branch?.itemId);
  const selectedId = selection?.kind === 'heart' ? loadout?.heart : selection?.kind === 'ability' ? branch?.itemId : selection ? branch?.supports[selection.socket] : null;
  const selectedItem = catalog.find(item => item.id === selectedId);
  const selectedRoute = selectedItem ? abilityGrowthRoute(selectedItem) : [];
  const selectedGrowth = selectedItem ? abilityGrowthSummary(selectedItem) : '';
  const showingBag = bagOpen || !selectedItem;
  const title = showingBag ? selection?.kind === 'heart' ? '背包 · 选择心法' : selection?.kind === 'ability' ? '背包 · 选择武器或技能' : '背包 · 选择辅助' : selectedItem?.name ?? '装备详情';
  const canEdit = Boolean(state && props.saveEquipment && !busy && !needsRefresh);
  const available = catalog.filter(item => {
    if (!state?.ownedIds.includes(item.id) || occupied.includes(item.id)) return false;
    if (selection?.kind === 'heart') return item.kind === 'heart';
    if (selection?.kind === 'ability') return item.kind === 'weapon' || item.kind === 'skill';
    return item.kind === 'support' && Boolean(ability && supportCompatible(item, ability));
  });
  const supply = heart ? heart.recovery / heart.interval : 0;
  const supplyText = supply.toFixed(2);
  const preview = loadout ? equipmentRuntime(loadout, manifest, state?.items) : null;
  let demand = 0;
  for (const entry of preview?.branches ?? []) {
    const speed = entry.item.kind === 'weapon' ? props.attackSpeed : props.castingSpeed;
    demand += abilityDemand(entry, speed);
  }
  const demandText = demand.toFixed(2);
  const selectedBranch = preview?.branches.find(entry => entry.item.id === selectedItem?.id);
  const selectedCost = (selectedItem?.cost ?? 0) * (selectedBranch?.costMultiplier ?? 1);
  const costText = selectedCost.toFixed(2);
  const speed = selectedItem?.kind === 'weapon' ? props.attackSpeed : props.castingSpeed;
  const interval = (selectedItem?.interval ?? 0) * (selectedBranch?.intervalMultiplier ?? 1) / speed;
  const intervalText = interval.toFixed(2);

  useEffect(() => {
    let active = true;
    if (!props.loadEquipment) { setError('场景预览不连接账号背包，请进入账号模式使用装备功能。'); return; }
    const request = props.loadEquipment();
    void request.then(current => { if (active) setState(current); }).catch(cause => { if (active) { const message = errorMessage(cause); setError(message); } });
    return () => { active = false; };
  }, [props.loadEquipment]);
  useEffect(() => {
    const current = popup.current;
    if (!current) return;
    if (selection && !current.open) current.showModal();
    else if (!selection && current.open) { current.close(); trigger.current?.focus(); }
  }, [selection]);

  function choose(next: Selection): void {
    if (pending.current) return;
    const active = document.activeElement;
    trigger.current = active instanceof HTMLElement ? active : null;
    setBagOpen(false); setNotice(''); setSelection(next);
  }
  function close(): void { if (!pending.current) setSelection(null); }
  async function refresh(): Promise<void> {
    if (!props.loadEquipment || pending.current) return;
    pending.current = true; setBusy(true); props.onBusyChange(true);
    try { const current = await props.loadEquipment(); setState(current); setError(''); setNeedsRefresh(false); setSelection(null); }
    catch (cause) { const message = errorMessage(cause); setError(message); }
    finally { pending.current = false; setBusy(false); props.onBusyChange(false); }
  }
  async function commit(next: EquipmentLoadoutData): Promise<void> {
    if (!state || !props.saveEquipment || pending.current || needsRefresh) return;
    const context = { catalog, ownedIds: state.ownedIds };
    const invalid = equipmentError(next, context);
    if (invalid) { setError(invalid); return; }
    pending.current = true; setBusy(true); props.onBusyChange(true); setError('');
    const data = { loadout: next, revision: state.revision };
    try {
      const saved = await props.saveEquipment(data);
      setState(saved); setSelection(null); setNotice('装配已保存，下次进入房间时生效。');
    } catch (cause) { const message = errorMessage(cause); setError(message); setNeedsRefresh(true); }
    finally { pending.current = false; setBusy(false); props.onBusyChange(false); }
  }
  function equip(item: EquipmentItem): void {
    if (!loadout || !selection || !canEdit) return;
    const next: EquipmentLoadoutData = { heart: loadout.heart, slots: loadout.slots.map(slot => slot ? { itemId: slot.itemId, supports: [...slot.supports] } : null) };
    if (selection.kind === 'heart') {
      next.heart = item.id; next.slots = [];
      for (let index = 0; index < item.slots; index += 1) next.slots.push(null);
    } else if (selection.kind === 'ability') {
      const supports: (string | null)[] = [];
      for (let index = 0; index < item.supportSlots; index += 1) supports.push(null);
      next.slots[selection.branch] = { itemId: item.id, supports };
    } else {
      const target = next.slots[selection.branch];
      if (!target) return;
      target.supports[selection.socket] = item.id;
    }
    void commit(next);
  }
  function unequip(): void {
    if (!loadout || !selection || !canEdit) return;
    const next: EquipmentLoadoutData = { heart: loadout.heart, slots: loadout.slots.map(slot => slot ? { itemId: slot.itemId, supports: [...slot.supports] } : null) };
    if (selection.kind === 'heart') { next.heart = null; next.slots = []; }
    else if (selection.kind === 'ability') next.slots[selection.branch] = null;
    else { const target = next.slots[selection.branch]; if (target) target.supports[selection.socket] = null; }
    void commit(next);
  }

  const lineNodes = slots.map((slot, index) => {
    const angle = -90 + index * 360 / slots.length;
    const point = position(angle, 270);
    const supportCount = slot?.supports.length ?? 0;
    const safeCount = Math.max(1, supportCount);
    const spread = Math.min(16, 60 / safeCount);
    const gemLines = slot?.supports.map((id, socket) => {
      const gemAngle = angle + (socket - (supportCount - 1) / 2) * spread;
      const gem = position(gemAngle, 421);
      return <line key={socket} x1={point.x} y1={point.y} x2={gem.x} y2={gem.y} className={id ? s.activeLine : s.dormantLine} />;
    });
    return <g key={index}><line x1="500" y1="500" x2={point.x} y2={point.y} className={slot ? s.activeLine : s.dormantLine} />{gemLines}</g>;
  });
  const abilityNodes = slots.map((slot, index) => {
    const angle = -90 + index * 360 / slots.length;
    const point = position(angle, 270);
    const item = catalog.find(entry => entry.id === slot?.itemId);
    const label = item ? `${item.name} Lv${item.level ?? 1}` : '装备能力';
    const symbol = symbolFor(item);
    const next: Selection = { kind: 'ability', branch: index, socket: 0 };
    const supportCount = slot?.supports.length ?? 0;
    const safeCount = Math.max(1, supportCount);
    const spread = Math.min(16, 60 / safeCount);
    const gemNodes = slot?.supports.map((id, socket) => {
      const gemAngle = angle + (socket - (supportCount - 1) / 2) * spread;
      const gem = position(gemAngle, 421);
      const support = catalog.find(entry => entry.id === id);
      const gemSymbol = symbolFor(support);
      const gemLabel = support ? `${support.name} · 查看详情` : `${label} · 空辅助格 · 打开背包`;
      const target: Selection = { kind: 'support', branch: index, socket };
      return <button key={socket} type="button" className={`${s.socket} ${id ? s.equipped : ''}`} style={{ left: `${gem.x / 10}%`, top: `${gem.y / 10}%` }} disabled={busy} aria-label={gemLabel} title={gemLabel} onClick={() => choose(target)}><Emblem kind={gemSymbol} /></button>;
    });
    return <div key={index}><button type="button" className={s.ability} style={{ left: `${point.x / 10}%`, top: `${point.y / 10}%` }} disabled={busy} aria-label={`${label} · ${item ? '查看详情' : '打开背包'}`} onClick={() => choose(next)}><Emblem kind={symbol} effect={item?.effect} /><span className={s.nodeLabel}>{label}</span></button>{gemNodes}</div>;
  });
  const inventoryNodes = available.map(item => {
    const symbol = symbolFor(item);
    const description = item.kind === 'heart' ? `${item.slots} 个能力槽 · 灵力容量 ${number(item.capacity)}` : item.kind === 'support' ? `消耗 ×${number(item.costMultiplier)} · 伤害 ×${number(item.damageMultiplier)} · 投射物 ×${item.projectiles ?? 1} · 兼容${item.host === 'both' ? '武器与技能' : item.host === 'weapon' ? '武器' : '技能'}` : `${item.supportSlots} 个辅助格 · 基础消耗 ${number(item.cost)} 灵力`;
    return <button key={item.id} type="button" className={s.bagItem} disabled={!canEdit} onClick={() => equip(item)}><Emblem kind={symbol} effect={item?.effect} /><span><small>{kindNames[item.kind]} · Lv{item.level ?? 1} · 未装备</small><b>{item.name}</b><small>{description}</small></span><em>装备</em></button>;
  });
  const heartSelection: Selection = { kind: 'heart', branch: 0, socket: 0 };
  const heartSymbol = symbolFor(heart);
  const selectedSymbol = symbolFor(selectedItem);
  const feedback = <>{error && <p className={s.feedback} role="alert">{error}<button type="button" disabled={busy} onClick={() => { void refresh(); }}>刷新装配</button></p>}{busy && <p className={s.feedback} role="status">正在保存装配，请稍候…</p>}</>;
  return <section className={s.cosmos} aria-label="心法与技能构筑" aria-busy={busy}>
    <div className={s.heading}><span>星 海 藏 灵 · 万 法 归 心</span><h2>心法构筑</h2><p>点击装备查看、替换或拆卸 · 点击空格从背包装备</p></div>
    {!state && !error && <p className={s.caption} role="status">正在读取账号装配与背包…</p>}
    {!selection && feedback}{notice && <p className={s.caption} role="status">{notice}</p>}
    <div className={s.board}>
      <svg className={s.orbits} viewBox="0 0 1000 1000" fill="none" aria-hidden="true"><circle cx="500" cy="500" r="460" /><circle cx="500" cy="500" r="451" /><circle cx="500" cy="500" r="360" /><circle cx="500" cy="500" r="350" /><circle cx="500" cy="500" r="202" /><circle cx="500" cy="500" r="192" /><path d="M500 23v26m-13-13h26M500 951v26m-13-13h26M23 500h26m-13-13v26M951 500h26m-13-13v26" />{lineNodes}</svg>
      {abilityNodes}
      <button type="button" className={s.heartNode} disabled={!state || busy} onClick={() => choose(heartSelection)} aria-label={heart ? `${heart.name} · 查看详情` : '空心法槽 · 打开背包'}><Emblem kind={heartSymbol} effect={heart?.effect} /><span className={s.nodeLabel}>{heart?.name ?? '装备心法'}</span><small>{heart ? `心法 Lv${heart.level ?? 1}` : '心法'}</small></button>
    </div>
    <p className={s.caption}>{heart ? `◇ ${heart.slots} 个能力槽 · 辅助格由各武器、技能提供 ◇` : '◇ 装备心法后展开能力槽，装备能力后展开辅助格 ◇'}</p>
    <dialog ref={popup} className={s.popup} aria-labelledby="build-detail-title" onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <header><div><small>{showingBag ? '从已拥有的物品中选择' : '当前出征装配'}</small><h2 id="build-detail-title">{title}</h2></div><button type="button" disabled={busy} onClick={close} aria-label="关闭详情">×</button></header>
      {feedback}
      {showingBag ? <><div className={s.bagList} aria-label="可装备物品列表">{inventoryNodes.length ? inventoryNodes : <div className={s.bag}><Emblem kind="gem" /><p>暂无可装备物品</p><small>只显示未装备且兼容当前槽位的物品。已装备物品需先拆下；辅助仅显示当前能力可用的类型。</small></div>}</div>{selectedItem && <button type="button" className={s.action} disabled={busy} onClick={() => setBagOpen(false)}>返回装备详情</button>}</> : selectedItem && <>
        <p className={s.note}>{equipmentDescription(selectedItem)} · {selectedGrowth} · 物品等级 {selectedItem.level ?? 1}</p><details><summary>完整成长路线</summary>{selectedRoute.map(entry => <p key={entry}>{entry}</p>)}</details>
        <div className={s.itemHero}><Emblem kind={selectedSymbol} effect={selectedItem.effect} /><span>{kindNames[selectedItem.kind]}{selection?.kind === 'support' && ` · 所属能力：${ability?.name ?? ''}`}</span></div>
        {selectedItem.kind === 'heart' ? <><dl><div><dt>灵力池容量</dt><dd>{number(selectedItem.capacity)}</dd></div><div><dt>恢复间隔</dt><dd>{number(selectedItem.interval)} 秒</dd></div><div><dt>每次恢复</dt><dd>{number(selectedItem.recovery)} 灵力</dd></div><div><dt>单次恢复魔法消耗</dt><dd>基础 {number(selectedItem.manaCost)}</dd></div><div><dt>角色魔法值上限</dt><dd>{props.maxMp}</dd></div><div><dt>能力槽数量</dt><dd>{selectedItem.slots}</dd></div><div><dt>理论平均供给</dt><dd>{supplyText} 灵力/秒</dd></div><div><dt>总满速需求</dt><dd>{demandText} 灵力/秒</dd></div></dl>{preview && <AttackRhythm runtime={preview} attackSpeed={props.attackSpeed} castingSpeed={props.castingSpeed} />}<p className={s.note}>所有能力共享灵力池，独立计时。平均供需不保证实际触发频率；缺能时等待。拆下或替换心法时，全部能力与辅助解除绑定并返回背包。</p></> : selectedItem.kind === 'support' ? <><dl><div><dt>灵力消耗倍率</dt><dd>× {number(selectedItem.costMultiplier)}</dd></div><div><dt>伤害倍率</dt><dd>× {number(selectedItem.damageMultiplier)}</dd></div><div><dt>投射物数量</dt><dd>× {selectedItem.projectiles ?? 1}</dd></div></dl><p className={s.note}>仅修饰所属能力，拆下后立即从构筑计算中移除。</p></> : <><dl><div><dt>最终单次灵力消耗</dt><dd>{costText}</dd></div><div><dt>最终执行间隔</dt><dd>{intervalText} 秒</dd></div><div><dt>辅助槽数量</dt><dd>{selectedItem.supportSlots}</dd></div></dl><p className={s.note}>消耗已计入所属辅助，间隔已计入对应速度。拆下或替换能力时，所属辅助解除绑定并返回背包。</p></>}
        <div className={s.actions}><button type="button" className={s.action} disabled={!canEdit} onClick={() => setBagOpen(true)}>替换装备</button><button type="button" className={`${s.action} ${s.remove}`} disabled={!canEdit} onClick={unequip}>拆卸到背包</button></div>
      </>}
      <footer>大厅物品为基础等级；心法与能力在5、10、15、20级解锁槽位。每件装备仅能占用一个位置。操作成功后自动保存，进入新房间时使用该构筑。</footer>
    </dialog>
  </section>;
}
