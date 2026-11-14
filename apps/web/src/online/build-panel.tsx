import { useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { BuildStateData, EquipmentLoadoutData, ExpeditionActionData, LootStateData, PlayerView, RefreshGrowthData, Snapshot } from '@web-game-world/contracts';
import { waveProfile } from '@web-game-world/simulation';
import { SkillPanel } from './skill-panel';
import { LevelRewards } from './level-rewards';
import { WavePreparation, WaveTeam } from './wave-preparation';
import { WaveLineup } from './wave-lineup';
import { WaveSummary } from './wave-summary';
import { ExpeditionDecision } from './expedition-decision';
import { RewardDialog } from './reward-dialog';
import { rewardPreview } from './reward-preview';
import { HudIcon } from '../hud/hud-icon';
import content from '../network/content';
import { useTutorial } from './tutorial/tutorial-context';
import { TutorialCard } from './tutorial/tutorial-ui';
import g from './tutorial/tutorial.module.css';
import s from './build-panel.module.css';
import ui from './reward-ui.module.css';
import w from './wave-rewards.module.css';

interface BuildPanelProps { connected: boolean; refresh: (data: RefreshGrowthData) => void; snapshot: Snapshot; waveReady: (ready: boolean, solo: boolean) => void; remind: () => void; resting: boolean; loot: LootStateData; player?: PlayerView; discard: (id: string) => void; state: BuildStateData; error: string; choose: (choiceId: number, index: number, targetId?: string) => void; equip: (loadout: EquipmentLoadoutData, revision: number) => void; decide?: (data: ExpeditionActionData) => void }
type Tab = 'rewards' | 'equipment' | 'skills' | 'decision';
interface ItemChanges { added: string[]; upgraded: Record<string, { before: number; after: number }> }
interface Receipt { id: number; title: string; source: string }

export function BuildPanel(props: BuildPanelProps) {
  const guide = useTutorial();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('rewards');
  const [focus, setFocus] = useState('');
  const [activeChoice, setActiveChoice] = useState(0);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [buildPending, setBuildPending] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [wavePending, setWavePending] = useState(false);
  const [waveError, setWaveError] = useState('');
  const [nextOpen, setNextOpen] = useState(false);
  const [picked, setPicked] = useState<Receipt[]>([]);
  const [changes, setChanges] = useState<ItemChanges>({ added: [], upgraded: {} });
  const knownItems = useRef<Map<string, number> | null>(null);
  const previous = useRef({ resting: false, decision: false, gifts: 0 });
  const waveRequest = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const preparation = props.snapshot.preparation;
  const expedition = props.snapshot.expedition;
  const playerId = props.player?.id ?? '';
  const decisionRequired = Boolean(expedition?.decision && !expedition.continuedIds.includes(playerId));
  const hellChoices = props.state.choices.filter(choice => choice.hellEntry);
  const hellGifts = Math.max(expedition?.gifts[playerId] ?? 0, hellChoices.length);
  const levelChoices = props.state.choices.filter(choice => choice.source === 'level');
  const waveChoices = props.state.choices.filter(choice => choice.source === 'wave' && !choice.hellEntry);
  const otherChoices = props.state.choices.filter(choice => choice.source === 'link');
  const remaining = props.state.choices.length - hellChoices.length + hellGifts;
  const choice = props.state.choices.find(choice => choice.id === activeChoice) ?? hellChoices[0] ?? waveChoices[0] ?? props.state.choices[0];
  const canOperate = props.connected && Boolean(props.player?.connected);
  const busy = rewardBusy || buildPending || decisionBusy;
  const solo = preparation?.participantIds.length === 1;
  const ready = preparation?.readyIds.includes(playerId) ?? false;
  const participant = preparation?.participantIds.includes(playerId) ?? false;
  const waveDisabled = decisionRequired || hellGifts > 0 || Boolean(expedition?.saving) || busy || wavePending || !canOperate || !participant || Boolean(props.snapshot.paused) || Boolean(solo && (props.player?.hp ?? 0) <= 0);
  const config = { ...content, difficulty: expedition?.difficulty ?? 'normal' };
  const context = { config };
  const nextRound = props.snapshot.round + 1;
  const next = waveProfile(context, nextRound);
  const nextPlan = props.snapshot.wavePlans?.next;
  const nextName = nextPlan?.round === nextRound ? nextPlan.name : next.wave.name;
  const nextHint = nextPlan?.round === nextRound ? nextPlan.hint : next.wave.hint;
  const countdown = Math.ceil(preparation?.countdown ?? 0);
  const waveLabel = wavePending || buildPending || decisionBusy ? '正在确认…' : solo ? '开始下一波' : ready ? '取消准备' : '准备下一波';
  const waveStatus = !canOperate ? '连接恢复后可继续操作' : props.snapshot.paused ? '游戏已暂停' : expedition?.saving ? props.snapshot.error || '正在保存本波成果…' : decisionRequired ? '先选择提取收益或继续挑战' : hellGifts > 0 ? `入场赠送成长还需选择 ${hellGifts} 次` : countdown > 0 ? `${countdown} 秒后开战` : ready ? '已准备 · 等待队友' : remaining > 0 ? '待选奖励可保留至下一波' : '整理完成即可出发';
  const upgrades = Object.keys(changes.upgraded);
  const changedIds = [...changes.added, ...upgrades];
  const changeLabel = `${changes.added.length ? ` · 新增 ${changes.added.length}` : ''}${upgrades.length ? ` · 升级 ${upgrades.length}` : ''}`;
  const coins = Math.max(0, props.state.coinsEarned - props.state.coinsSpent);
  const rewardLabel = `${props.resting ? '本波收获' : '选择奖励'}${remaining > 0 ? ` · 待选 ${remaining}` : ''}`;
  const receipts = picked.filter(receipt => !props.state.choices.some(choice => choice.id === receipt.id));
  const needsReward = !guide.data?.milestones.includes('reward');
  const needsBuild = !guide.data?.milestones.includes('battle-build');
  const learning = guide.active && (needsReward || needsBuild);
  const canReviewChanges = changedIds.length > 0 || props.state.level > 1;
  const pointReward = learning && guide.expanded && needsReward && remaining > 0;
  const pointBuild = learning && guide.expanded && needsBuild && props.resting && canReviewChanges && (!needsReward || remaining === 0);

  useEffect(() => { if (learning && open && (tab === 'skills' || tab === 'equipment') && props.resting && canReviewChanges) guide.mark('battle-build-viewed'); }, [learning, open, tab, props.resting, canReviewChanges, guide.mark]);
  useEffect(() => { waveRequest.current = false; setWavePending(false); setWaveError(''); }, [props.snapshot.round, props.resting, ready, solo, props.connected, props.snapshot.paused]);
  useEffect(() => { setPicked([]); setActiveChoice(0); setNextOpen(false); }, [props.snapshot.round]);
  useEffect(() => { setBuildPending(false); }, [props.state.revision, props.error, props.connected]);
  useEffect(() => {
    if (!wavePending && !buildPending) return;
    const timer = window.setTimeout(() => { waveRequest.current = false; setWavePending(false); setBuildPending(false); setWaveError('尚未收到操作确认，请重试'); }, 8000);
    return () => window.clearTimeout(timer);
  }, [wavePending, buildPending]);
  useEffect(() => { if (props.error) { waveRequest.current = false; setWavePending(false); } }, [props.error]);
  useEffect(() => {
    const entries = props.state.items.map(item => [item.id, Math.min(20, item.level + item.bonus)] as const);
    const levels = new Map(entries);
    const before = knownItems.current;
    knownItems.current = levels;
    if (!before) return;
    setChanges(current => {
      const added = current.added.filter(id => levels.has(id));
      const upgraded: ItemChanges['upgraded'] = {};
      for (const [id, change] of Object.entries(current.upgraded)) { const level = levels.get(id); if (level !== undefined && level > change.before) upgraded[id] = { before: change.before, after: level }; }
      for (const [id, level] of levels) {
        const previous = before.get(id);
        if (previous === undefined && !added.includes(id)) added.push(id);
        else if (previous !== undefined && level > previous) upgraded[id] = { before: upgraded[id]?.before ?? previous, after: level };
      }
      return { added, upgraded };
    });
  }, [props.state.items]);
  useEffect(() => {
    function keyDown(event: KeyboardEvent): void {
      const element = event.target;
      const dialogs = document.querySelectorAll('dialog[open]');
      if (dialogs.length > 1) return;
      if (busy || event.repeat || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return;
      if (event.code !== 'KeyB' && event.code !== 'KeyK') return;
      event.preventDefault();
      if (open) setOpen(false); else reveal(event.code === 'KeyK' ? 'skills' : 'equipment');
    }
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [open, busy]);
  useEffect(() => {
    const before = previous.current;
    previous.current = { resting: props.resting, decision: decisionRequired, gifts: hellGifts };
    if (!props.resting && before.resting) { setOpen(false); setNextOpen(false); return; }
    if (decisionRequired && !before.decision && props.decide) { setTab('decision'); setOpen(true); return; }
    if (hellGifts > 0 && before.gifts === 0) { setTab('rewards'); setOpen(true); return; }
    if (props.resting && !before.resting) { setTab(decisionRequired && props.decide ? 'decision' : 'rewards'); setOpen(true); }
  }, [props.resting, decisionRequired, hellGifts, props.decide]);
  useEffect(() => { const panel = dialog.current; if (open && panel && !panel.open) panel.showModal(); else if (!open && panel?.open) panel.close(); }, [open]);

  function close(): void { setOpen(false); }
  function closed(event: SyntheticEvent<HTMLDialogElement>): void {
    if (event.target !== event.currentTarget) return;
    setOpen(false);
    const canvas = document.querySelector<HTMLCanvasElement>('canvas');
    canvas?.focus({ preventScroll: true });
  }
  function reveal(next: Tab): void { if (busy && next !== tab) return; setFocus(''); setTab(next); setOpen(true); }
  function openChanges(id?: string): void { if (busy) { if (tab === 'skills' || tab === 'equipment') setOpen(true); return; } const latest = id ?? changedIds[changedIds.length - 1] ?? ''; setFocus(latest); setTab('skills'); setOpen(true); }
  function openTutorialTarget(): void { if (needsReward && remaining > 0) reveal('rewards'); else openChanges(); }
  function viewed(id: string): void { setChanges(current => { const added = current.added.filter(item => item !== id); const upgraded = { ...current.upgraded }; delete upgraded[id]; return { added, upgraded }; }); }
  function chooseReward(id: number, index: number, targetId?: string): void {
    const selected = props.state.choices.find(choice => choice.id === id);
    const option = selected?.options[index];
    if (!selected || !option || !canOperate) return;
    const context = { state: props.state, player: props.player, choice: selected, targetId };
    const view = rewardPreview(option, context);
    const title = option.kind === 'item' ? `${view.title}已领取到储备` : `${view.title} · ${view.headline}`;
    const source = selected.hellEntry ? '入场赠送' : selected.source === 'wave' ? '波次奖励' : selected.source === 'level' ? '等级成长' : '构筑奖励';
    props.choose(id, index, targetId);
    setPicked(previous => [...previous.filter(receipt => receipt.id !== id), { id, title, source }]);
  }
  function equip(loadout: EquipmentLoadoutData, revision: number): void { if (busy || !canOperate) return; setBuildPending(true); props.equip(loadout, revision); }
  function discard(id: string): void { if (busy || !canOperate) return; setBuildPending(true); props.discard(id); }
  function decide(data: ExpeditionActionData): void { if (canOperate) props.decide?.(data); }
  function advanceWave(): void { if (waveDisabled || waveRequest.current || !props.resting) return; waveRequest.current = true; setWavePending(true); setWaveError(''); const prepared = solo || !ready; props.waveReady(prepared, solo); }
  const groups = <div className={w.groups}>{waveChoices.length > 0 && <button aria-pressed={choice?.source === 'wave' && !choice.hellEntry} disabled={busy} onClick={() => setActiveChoice(waveChoices[0].id)}>波次奖励 {waveChoices.length}</button>}{levelChoices.length > 0 && <button aria-pressed={choice?.source === 'level'} disabled={busy} onClick={() => setActiveChoice(levelChoices[0].id)}>等级成长 {levelChoices.length}</button>}{hellChoices.length > 0 && <button aria-pressed={Boolean(choice?.hellEntry)} disabled={busy} onClick={() => setActiveChoice(hellChoices[0].id)}>入场赠送 {hellGifts}</button>}{otherChoices.length > 0 && <button aria-pressed={choice?.source === 'link'} disabled={busy} onClick={() => setActiveChoice(otherChoices[0].id)}>构筑奖励 {otherChoices.length}</button>}</div>;
  return <>
    <aside className={s.income} aria-label="本局收获"><div className={s.coins}><span className={s.coinIcon} aria-hidden="true" /><span>本局金币 <b>{coins}</b></span></div><button className={s.safe} onClick={() => reveal('equipment')} aria-label="查看保险箱"><HudIcon name="safe" size={35} /><span>保险箱 {props.loot.safe.length}件</span></button></aside>
    <nav className={s.launcher} aria-label="局内成长"><button className={!open && pointReward ? g.target : undefined} onClick={() => reveal('rewards')} aria-label={rewardLabel}><HudIcon name="reward" />{remaining > 0 && <b className={s.badge}>{remaining}</b>}<span>奖励</span></button><button className={!open && pointBuild ? g.target : undefined} onClick={() => openChanges()} aria-label={`本局构筑${changeLabel}`}><HudIcon name="build" /><kbd>K</kbd>{changedIds.length > 0 && <b className={s.badge}>{changedIds.length}</b>}<span>构筑</span></button><button data-loot-target="bag" onClick={() => reveal('equipment')} aria-label={`背包 · ${props.state.items.length}`}><HudIcon name="bag" /><kbd>B</kbd><span>背包 {props.state.items.length}</span></button></nav>
    {props.resting && !open && <div className={s.readyBar}><button className={s.advance} disabled={waveDisabled} onClick={advanceWave}>{waveLabel}</button><span role="status">{waveError || waveStatus}</span></div>}
    {learning && !open && (needsReward || needsBuild) && <div className={g.battleGuide}><TutorialCard compact={!props.resting} title={needsReward && remaining > 0 ? '选择奖励，强化本局构筑' : props.resting && canReviewChanges ? '查看本局构筑的变化' : '技能自动攻击，移动躲避怪物'} text="奖励可以升级心法和技能，也能获得新物品。休息时比较并调整构筑。" step={4} action={remaining > 0 || props.resting && canReviewChanges ? '查看' : undefined} onAction={openTutorialTarget} /></div>}
    <dialog ref={dialog} className={s.dialog} aria-label={props.resting ? '本波收获' : '成长奖励'} onCancel={event => { event.preventDefault(); close(); }} onClose={closed}>
      <section className={`${ui.panel} ${w.panel}`}>
        <header className={ui.header}><h1>{props.resting ? '本波收获' : '成长奖励'}</h1><span className={ui.remaining}>{props.resting ? expedition?.hellFloor ? `地狱 ${expedition.hellFloor} 层完成` : `第 ${props.snapshot.round} 波完成` : `第 ${props.snapshot.round} 波`}</span><button className={ui.close} aria-label="收起本波收获" onClick={close}>×</button></header>
        <WaveSummary state={props.state} snapshot={props.snapshot} loot={props.loot} playerId={playerId} remaining={remaining} resting={props.resting} />
        <nav className={w.tabs} aria-label="休整功能"><button className={pointReward ? g.target : undefined} aria-selected={tab === 'rewards'} disabled={busy} onClick={() => reveal('rewards')}>奖励选择{remaining > 0 && ` · ${remaining}`}</button><button className={pointBuild ? g.target : undefined} aria-selected={tab === 'skills' || tab === 'equipment'} disabled={busy} onClick={() => openChanges()}>构筑与储备{changedIds.length > 0 && ` · 变化 ${changedIds.length}`}</button>{expedition?.decision && props.decide && <button aria-selected={tab === 'decision'} disabled={busy} onClick={() => reveal('decision')}>{decisionRequired ? '提取 / 继续' : '挑战选择'}</button>}</nav>
        {!canOperate && <p className={w.warning} role="status">连接中断，正在等待重连。奖励和准备操作暂不可用。</p>}
        <div className={w.body}>
          {learning && (needsReward || needsBuild) && <TutorialCard title={needsReward && remaining > 0 ? '自由选择一项奖励' : '查看升级与新物品，完善构筑'} text="新物品领取后进入储备。比较效果、消耗和激活条件，再调整构筑。" step={4} action={pointBuild && tab === 'rewards' ? '查看构筑变化' : undefined} onAction={() => openChanges()} />}
          {tab === 'rewards' ? <>
            {choice ? <LevelRewards key={choice.id} groups={groups} state={props.state} choice={choice} player={props.player} error={props.error} disabled={!canOperate} refresh={props.refresh} choose={chooseReward} onBusyChange={setRewardBusy} /> : remaining === 0 && <section className={w.completed}><h2>{props.resting ? '本波奖励已处理' : '暂无待选奖励'}</h2><p>金币收入已计入本局收益，领取的新物品保存在储备中。</p>{receipts.length > 0 && <div>{receipts.map(receipt => <article key={receipt.id}><small>{receipt.source}</small><strong>{receipt.title}</strong></article>)}</div>}<button className={ui.select} onClick={() => openChanges()}>查看构筑变化</button></section>}
            {remaining > 0 && !choice && <p className={w.warning} role="status">下一次奖励正在同步，请稍候。</p>}
            <WavePreparation state={props.state} added={changes.added.length} upgraded={changes.upgraded} open={openChanges} />
          </> : tab === 'decision' ? <ExpeditionDecision snapshot={props.snapshot} playerId={playerId} coins={coins} items={props.loot.safe.length} error={props.error || props.snapshot.error} disabled={!canOperate || !props.decide} choose={decide} onBusyChange={setDecisionBusy} /> : <fieldset className={w.buildView} disabled={!canOperate || buildPending}><SkillPanel state={props.state} player={props.player} focus={focus} unseen={changes.added} upgraded={changes.upgraded} viewed={viewed} discard={discard} equip={equip} />{tab === 'equipment' && <section className={s.safeItems} aria-label="保险箱物品"><h3>保险箱 · {props.loot.safe.length}件</h3>{props.loot.safe.length ? props.loot.safe.map(item => <p key={item.id}>{item.name} · Lv.{item.level}</p>) : <p>暂未获得可带出物品</p>}</section>}</fieldset>}
          {props.error && tab !== 'rewards' && tab !== 'decision' && <p className={w.warning} role="alert">{props.error}</p>}
        </div>
        {props.resting && preparation && <footer className={w.footer}><div className={w.next}><strong>下一波 · {nextRound > 20 ? `地狱 ${nextRound - 20} 层` : `第 ${nextRound} 波`}</strong><button className={w.link} onClick={() => setNextOpen(true)} title={nextName}><span>{nextName} · </span>波次情报 ›</button></div><WaveTeam snapshot={props.snapshot} connected={canOperate} remind={props.remind} /><div className={w.advance}><span role="status">{waveError || waveStatus}</span><button className={ui.select} disabled={waveDisabled} onClick={advanceWave}>{waveLabel}</button></div></footer>}
        <div className={w.wallet}><i className={w.coin} />本局金币 <b>{coins}</b></div>
      </section>
      {nextOpen && <RewardDialog title={`下一波 · ${nextName}`} close={() => setNextOpen(false)}><p>{nextHint}</p><WaveLineup plan={nextPlan} timeline /></RewardDialog>}
    </dialog>
  </>;
}
