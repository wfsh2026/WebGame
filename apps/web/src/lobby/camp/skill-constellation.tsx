import { useEffect, useRef, useState } from 'react';
import { abilityDemand, buildCatalog, characterSlots, equippedIds, equipmentCatalog, equipmentError, equipmentRuntime, heartCapacity, heartSupply, starterEquipmentIds, supportCompatible } from '@web-game-world/simulation';
import type { EquipmentItem } from '@web-game-world/simulation';
import type { EquipmentLoadoutData, EquipmentStateData } from '@web-game-world/contracts';
import type { LobbyViewProps } from '../../online/lobby-view';
import { TutorialCard } from '../../online/tutorial/tutorial-ui';
import { useTutorial } from '../../online/tutorial/tutorial-context';
import { newRequestId } from '../../network/request-id';
import manifest from '../../network/content';
import { SkillBoard, type SkillSelection } from './skill-board';
import { SkillDetails } from './skill-details';
import s from './skill-loadout.module.css';

interface ConstellationProps { onOpenExpeditions?: () => void; onClose?: () => void; copyEquipment?: LobbyViewProps['copyEquipment']; magicalAttack?: number; attackSpeed: number; castingSpeed: number; energyCapacityBonus: number; loadEquipment: LobbyViewProps['loadEquipment']; saveEquipment: LobbyViewProps['saveEquipment']; onBusyChange: (busy: boolean) => void }
type Review = { kind: 'copy' } | { kind: 'change'; loadout: EquipmentLoadoutData; message: string };
const baseCatalog = equipmentCatalog(manifest);
const heartSelection: SkillSelection = { kind: 'heart', branch: 0, socket: 0 };

function errorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.name === 'TimeoutError') return '保存响应超时，请刷新装配状态后继续。';
  if (cause instanceof Error && cause.name === 'ZodError') return '装配数据格式不兼容，请更新客户端与服务端后重试。';
  if (cause instanceof TypeError || cause instanceof SyntaxError) return '暂时无法连接装备服务，请刷新后重试。';
  return cause instanceof Error ? cause.message : '装配操作失败，请刷新后重试。';
}

function initialSelection(loadout: EquipmentLoadoutData): SkillSelection {
  const branch = loadout.slots.findIndex(slot => Boolean(slot));
  return branch < 0 ? heartSelection : { kind: 'ability', branch, socket: 0 };
}

function starterBuild(catalog: EquipmentItem[], level: number): EquipmentLoadoutData | null {
  const starters = catalog.filter(item => item.id.startsWith('starter:'));
  const heart = starters.find(item => item.definitionId === starterEquipmentIds[0]) ?? starters.find(item => item.kind === 'heart');
  if (!heart) return null;
  const capacity = characterSlots(level);
  const abilities = starters.filter(item => item.kind === 'skill');
  abilities.sort((left, right) => {
    const leftPriority = Number(left.definitionId === starterEquipmentIds[1]);
    const rightPriority = Number(right.definitionId === starterEquipmentIds[1]);
    return rightPriority - leftPriority;
  });
  for (const ability of abilities) {
    const matches = starters.filter(item => item.kind === 'support' && supportCompatible(item, ability));
    const support = matches.find(item => item.definitionId === starterEquipmentIds[2]) ?? matches[0];
    if (!support) continue;
    const supports = Array.from({ length: capacity.supports }, (_, index) => index === 0 ? support.id : null);
    const slots = Array.from({ length: capacity.abilities }, (_, index) => index === 0 ? { itemId: ability.id, supports } : null);
    return { heart: heart.id, slots };
  }
  return null;
}

export function SkillConstellation(props: ConstellationProps) {
  const guide = useTutorial();
  const [state, setState] = useState<EquipmentStateData | null>(null);
  const [selection, setSelection] = useState<SkillSelection>(heartSelection);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [reviewKind, setReviewKind] = useState<SkillSelection['kind']>('heart');
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const confirmation = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const copyRequest = useRef<{ requestId: string; revision: number; coins: number } | null>(null);
  const loadout = state?.loadout;
  const capacity = characterSlots(state?.characterLevel ?? 1);
  const catalog = state ? buildCatalog(manifest, state.items) : baseCatalog;
  const heart = catalog.find(item => item.id === loadout?.heart);
  const occupied = loadout ? equippedIds(loadout) : [];
  const runtime = loadout ? equipmentRuntime(loadout, manifest, state?.items) : null;
  const supply = heartSupply(heart);
  const energyCapacity = heartCapacity(heart, props.energyCapacityBonus);
  let demand = 0;
  for (const entry of runtime?.branches ?? []) {
    const speed = entry.item.skillType === 'melee' ? props.attackSpeed : props.castingSpeed;
    demand += abilityDemand(entry, speed);
  }
  const impossible = runtime?.branches.some(entry => entry.item.cost * entry.costMultiplier > energyCapacity) ?? false;
  const energyStatus = !heart ? '尚未装配心法' : impossible ? '有技能耗能超过容量' : demand > supply ? '持续耗能高于供给' : '平均供给充足';
  const supplyText = supply.toFixed(2); const demandText = demand.toFixed(2);
  const canEdit = Boolean(state && props.saveEquipment && !busy && !needsRefresh);
  const recommendedBuild = state && !occupied.length ? starterBuild(catalog, state.characterLevel) : null;
  const learning = guide.active && guide.phase === 'build';
  const context = state ? { catalog, ownedIds: state.ownedIds, characterLevel: state.characterLevel } : null;
  const invalid = loadout && context ? equipmentError(loadout, context) : '';
  const guideReady = Boolean(!invalid && runtime?.branches.some(entry => entry.supportIds.length > 0 && entry.item.cost * entry.costMultiplier <= energyCapacity));
  const tutorialKind = !heart ? 'heart' : !runtime?.branches.length ? 'ability' : !runtime.branches.some(entry => entry.supportIds.length > 0) ? 'support' : reviewKind;
  const teaching = learning && guide.expanded ? tutorialKind : undefined;
  const guideText = !heart ? '点击中央槽位选择心法。' : !runtime?.branches.length ? '点击技能空槽，连接近战或远程技能。' : !guideReady ? '点击技能旁的辅助槽，装入兼容宝石。' : '查看心法、技能和辅助后，即可前往秘境。';
  const copyIds = state?.previousLoadout ? equippedIds(state.previousLoadout) : [];
  const copyNames = copyIds.map(id => baseCatalog.find(item => item.id === id)?.name ?? id);
  const copyDisabled = !state || busy || needsRefresh || Boolean(state.copyError) || !props.copyEquipment || !state.previousLoadout;
  const copyTitle = state?.copyError || (!state?.previousLoadout ? '完成一次冒险后，可在此复制上一局构筑' : '查看清单与费用后确认购买');
  const feedback = error || (busy ? '正在保存装配…' : notice);

  useEffect(() => {
    let active = true;
    if (!props.loadEquipment) { setError('场景预览不连接账号背包，请进入账号模式使用装备功能。'); return; }
    const request = props.loadEquipment();
    const loaded = request.then(current => {
      if (!active) return;
      const target = initialSelection(current.loadout);
      setState(current); setSelection(target);
    });
    void loaded.catch(cause => { if (active) { const message = errorMessage(cause); setError(message); } });
    return () => { active = false; };
  }, [props.loadEquipment]);

  useEffect(() => {
    const dialog = confirmation.current;
    if (!dialog) return;
    if (review && !dialog.open) dialog.showModal();
    else if (!review && dialog.open) dialog.close();
  }, [review]);

  function choose(target: SkillSelection): void {
    if (pending.current) return;
    setSelection(target); setNotice('');
    setSelectionVersion(value => value + 1);
    if (learning && guideReady) setReviewKind(target.kind === 'heart' ? 'ability' : 'support');
    const compact = window.matchMedia('(max-width: 700px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (compact.matches) requestAnimationFrame(() => {
      const details = document.querySelector('[aria-label="装备操作"]');
      details?.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' });
    });
  }
  function showBoard(): void {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const behavior = reduced.matches ? 'auto' : 'smooth';
    const board = document.querySelector('[aria-label="心法与技能连接图"]');
    const dialog = board?.closest('dialog');
    dialog?.scrollTo({ top: 0, behavior });
    const panel = dialog?.firstElementChild;
    panel?.scrollTo({ top: 0, behavior });
  }
  function closeReview(): void { if (!pending.current) setReview(null); }
  function finishTutorial(): void {
    if (!guideReady || busy || needsRefresh) return;
    guide.mark('build-reviewed'); props.onOpenExpeditions?.();
  }
  async function refresh(): Promise<void> {
    if (!props.loadEquipment || pending.current) return;
    pending.current = true; setBusy(true); props.onBusyChange(true);
    try {
      const current = await props.loadEquipment();
      const target = initialSelection(current.loadout);
      setState(current); setSelection(target); setError(''); setNeedsRefresh(false); setReview(null);
    } catch (cause) { const message = errorMessage(cause); setError(message); }
    finally { pending.current = false; setBusy(false); props.onBusyChange(false); }
  }
  async function commit(next: EquipmentLoadoutData): Promise<void> {
    if (!state || !props.saveEquipment || pending.current || needsRefresh || !context) return;
    const invalid = equipmentError(next, context);
    if (invalid) { setError(invalid); return; }
    pending.current = true; setBusy(true); props.onBusyChange(true); setError('');
    const data = { loadout: next, revision: state.revision };
    try {
      const saved = await props.saveEquipment(data);
      setState(saved); setReview(null); setNotice('装配已保存');
      if (saved.loadout.heart !== loadout?.heart) setSelection(heartSelection);
      const savedRuntime = equipmentRuntime(saved.loadout, manifest, saved.items);
      const savedCapacity = heartCapacity(savedRuntime.heartItem, props.energyCapacityBonus);
      const ready = savedRuntime.branches.some(entry => entry.supportIds.length > 0 && entry.item.cost * entry.costMultiplier <= savedCapacity);
      if (ready) guide.mark('build-reviewed');
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message); setNeedsRefresh(true); setReview(null);
    } finally { pending.current = false; setBusy(false); props.onBusyChange(false); }
  }
  function propose(next: EquipmentLoadoutData, removed: (string | null)[]): void {
    const retained = equippedIds(next);
    const affected = removed.filter(id => id && !retained.includes(id));
    if (!affected.length) { void commit(next); return; }
    const names = affected.map(id => catalog.find(item => item.id === id)?.name ?? id);
    const message = `此操作会将 ${names.join('、')} 退回大厅背包。`;
    const change: Review = { kind: 'change', loadout: next, message };
    setReview(change);
  }
  function equip(item: EquipmentItem): void {
    if (!loadout || !canEdit) return;
    const slots = loadout.slots.map(slot => slot ? { itemId: slot.itemId, supports: [...slot.supports] } : null);
    const next: EquipmentLoadoutData = { heart: loadout.heart, slots };
    const branch = slots[selection.branch];
    if (selection.kind === 'heart') {
      next.heart = item.id;
      next.slots = Array.from({ length: capacity.abilities }, () => null);
      const removed = loadout.slots.flatMap(slot => slot ? [slot.itemId, ...slot.supports] : []);
      propose(next, removed);
    } else if (selection.kind === 'ability') {
      const supports = Array.from({ length: capacity.supports }, () => null);
      next.slots[selection.branch] = { itemId: item.id, supports };
      const removed = branch?.supports ?? [];
      propose(next, removed);
    } else {
      if (!branch) return;
      branch.supports[selection.socket] = item.id;
      void commit(next);
    }
  }
  function unequip(): void {
    if (!loadout || !canEdit) return;
    const slots = loadout.slots.map(slot => slot ? { itemId: slot.itemId, supports: [...slot.supports] } : null);
    const next: EquipmentLoadoutData = { heart: loadout.heart, slots };
    const branch = slots[selection.branch];
    if (selection.kind === 'heart') {
      next.heart = null; next.slots = [];
      const removed = loadout.slots.flatMap(slot => slot ? [slot.itemId, ...slot.supports] : []);
      propose(next, removed);
    } else if (selection.kind === 'ability') {
      next.slots[selection.branch] = null;
      const removed = branch?.supports ?? [];
      propose(next, removed);
    } else {
      if (!branch) return;
      branch.supports[selection.socket] = null;
      void commit(next);
    }
  }
  function equipStarter(): void { if (recommendedBuild && !occupied.length && canEdit) void commit(recommendedBuild); }
  async function copyPrevious(): Promise<void> {
    if (!state || !props.copyEquipment || pending.current || copyDisabled || state.coins < state.copyCoins) return;
    pending.current = true; setBusy(true); props.onBusyChange(true); setError('');
    try {
      if (!copyRequest.current || copyRequest.current.revision !== state.revision || copyRequest.current.coins !== state.copyCoins) {
        const requestId = newRequestId();
        copyRequest.current = { requestId, revision: state.revision, coins: state.copyCoins };
      }
      const saved = await props.copyEquipment(copyRequest.current);
      const target = initialSelection(saved.loadout);
      setState(saved); setSelection(target); setReview(null); copyRequest.current = null;
      setNotice('上一局构筑已购买并装备，原装备已退回背包');
      const savedRuntime = equipmentRuntime(saved.loadout, manifest, saved.items);
      if (savedRuntime.branches.some(entry => entry.supportIds.length > 0)) guide.mark('build-reviewed');
    } catch (cause) { const message = errorMessage(cause); setError(message); setReview(null); }
    finally { pending.current = false; setBusy(false); props.onBusyChange(false); }
  }
  function confirmReview(): void {
    if (review?.kind === 'copy') void copyPrevious();
    else if (review?.kind === 'change') void commit(review.loadout);
  }
  const copyReview: Review = { kind: 'copy' };
  const detailKey = `${selection.kind}-${selection.branch}-${selection.socket}-${state?.revision}-${selectionVersion}`;
  return <section className={s.loadout} aria-label="心法与技能构筑" aria-busy={busy}>
    <header className={s.header}><span className={s.character}>角色 Lv.{state?.characterLevel ?? '—'}</span><h1 id="camp-panel-title">技能搭配</h1><div className={s.headerActions}><button type="button" className={s.copy} disabled={copyDisabled} title={copyTitle} onClick={() => setReview(copyReview)}>↻ 复制上一局</button>{props.onClose && <button type="button" className={s.close} aria-label="关闭技能搭配" disabled={busy} onClick={props.onClose}>×</button>}</div></header>
    {learning && <div className={s.tutorial}><TutorialCard compact title={guideReady ? '构筑已就绪' : '连接你的第一套构筑'} text={guideText} step={2} action={guideReady ? '前往秘境' : undefined} onAction={finishTutorial} /></div>}
    {feedback && <div className={s.feedback} role={error ? 'alert' : 'status'}><span>{feedback}</span>{error && <button type="button" disabled={busy} onClick={() => { void refresh(); }}>刷新装配</button>}</div>}
    <div className={s.body}><div className={s.boardArea}><SkillBoard loadout={loadout} catalog={catalog} characterLevel={state?.characterLevel ?? 1} selection={selection} busy={busy || !state} teaching={teaching} choose={choose} />{recommendedBuild && <button className={s.starter} type="button" disabled={!canEdit} onClick={equipStarter}>一键装配保底组合</button>}</div><aside className={s.detail} aria-label="装备操作"><button type="button" className={s.mobileBack} onClick={showBoard}>↑ 返回构筑</button>{state ? <SkillDetails key={detailKey} state={state} catalog={catalog} selection={selection} attackSpeed={props.attackSpeed} castingSpeed={props.castingSpeed} capacityBonus={props.energyCapacityBonus} magicalAttack={props.magicalAttack} canEdit={canEdit} choose={choose} equip={equip} unequip={unequip} /> : <div className={s.empty}><p>{error ? '刷新装配后继续' : '正在读取账号装配…'}</p></div>}</aside></div>
    <footer className={s.energy} aria-label="共享灵力供需预览" title="理论供需不保证实际触发频率；技能独立计时，缺能时等待。"><span>灵力上限 <b>{energyCapacity}</b></span><span>理论供给 <b>{supplyText}/秒</b></span><span>满速需求 <b>{demandText}/秒</b></span><strong className={impossible || demand > supply ? s.warning : ''}>{energyStatus}</strong></footer>
    <dialog ref={confirmation} className={s.confirmation} aria-labelledby="skill-confirm-title" onCancel={event => { event.preventDefault(); event.stopPropagation(); closeReview(); }} onClick={event => { if (event.target === event.currentTarget) closeReview(); }}><h2 id="skill-confirm-title">{review?.kind === 'copy' ? '复制上一局构筑' : '确认装配变更'}</h2>{review?.kind === 'copy' && state ? <><p>{copyNames.join('、')}</p><dl className={s.stats}><div><dt>一级物品</dt><dd>{state.copyBaseCoins} 金币</dd></div><div><dt>快捷购买费用 50%</dt><dd>{state.copyCoins - state.copyBaseCoins} 金币</dd></div><div><dt>合计</dt><dd>{state.copyCoins} 金币</dd></div><div><dt>当前金币</dt><dd>{state.coins}</dd></div></dl><p>购买后装配整套构筑，当前装备退回大厅背包。</p>{state.coins < state.copyCoins && <p className={s.warning}>金币不足，无法复制。</p>}</> : review?.kind === 'change' && <p>{review.message}</p>}<div className={s.actions}><button type="button" className={s.primary} disabled={busy || (review?.kind === 'copy' && (!state || state.coins < state.copyCoins))} onClick={confirmReview}>{review?.kind === 'copy' ? '购买并装备' : '确认变更'}</button><button type="button" className={s.secondary} disabled={busy} onClick={closeReview}>取消</button></div></dialog>
  </section>;
}
