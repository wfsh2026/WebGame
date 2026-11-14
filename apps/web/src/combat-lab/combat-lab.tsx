import { useEffect, useRef, useState } from 'react';
import { createLabState, getAbilities, stepLab } from './simulation';
import type { LabState } from './simulation';
import type { ArenaHandle } from './arena-scene';
import { getInventory, hearts, initialLoadout, toConfig } from './loadout';
import type { Loadout, Socket } from './loadout';
import s from './combat-lab.module.css';
function Arena({ state }: { state: LabState }) {
  const parent = useRef<HTMLDivElement>(null);
  const handle = useRef<ArenaHandle | null>(null);
  const processed = useRef(state.sequence);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    setError(false);
    setReady(false);
    async function load() {
      try {
        const module = await import('./arena-scene');
        if (disposed || !parent.current) return;
        handle.current = module.createArena(parent.current);
        setReady(true);
      } catch {
        if (!disposed) setError(true);
      }
    }
    void load();
    return () => { disposed = true; handle.current?.destroy(); handle.current = null; };
  }, [attempt]);
  useEffect(() => {
    if (state.sequence < processed.current) processed.current = 0;
    const events = state.events.filter((event) => event.id > processed.current);
    events.reverse();
    for (const event of events) {
      if (event.kind === 'melee' || event.kind === 'ranged') handle.current?.fire(event);
    }
    processed.current = state.sequence;
  }, [state.events, state.sequence]);
  function retry() { setAttempt(attempt + 1); }
  return <div><div className={s.arena} ref={parent} role="img" aria-label="近战技能与远程技能独立向训练木桩发动攻击的实时画面" />{!ready && !error && <p>正在加载训练场…</p>}{error && <p role="alert">训练场加载失败，数值模拟仍可使用。<button onClick={retry}>重新加载画面</button></p>}</div>;
}

const socketNames: Record<Socket, string> = { heart: '心法', melee: '近战技能', ranged: '技能', 'melee-support': '近战技能辅助', 'ranged-support': '技能辅助' };

function getSocketItem(loadout: Loadout, socket: Socket) {
  const inventory = getInventory(socket);
  const id = socket === 'melee-support' ? loadout.meleeSupport : socket === 'ranged-support' ? loadout.rangedSupport : loadout[socket];
  return inventory.find((item) => item.id === id);
}

function ConnectionBoard({ loadout, focus, onSelect, state }: { loadout: Loadout; focus?: Socket; onSelect?: (socket: Socket) => void; state?: LabState }) {
  const config = toConfig(loadout);
  const abilities = getAbilities(config);
  const heart = hearts.find((item) => item.id === loadout.heart);
  function socketButton(socket: Socket) {
    const item = getSocketItem(loadout, socket);
    const auxiliary = socket === 'melee-support' || socket === 'ranged-support';
    const parentMissing = socket === 'heart' ? false : !heart || (socket === 'melee-support' && !loadout.melee) || (socket === 'ranged-support' && !loadout.ranged);
    const className = `${s.socket} ${socket === 'heart' ? s.heartSocket : auxiliary ? s.supportSocket : s.abilitySocket} ${focus === socket ? s.selected : ''}`;
    function select() { onSelect?.(socket); }
    return <button type="button" className={className} onClick={select} disabled={!onSelect || parentMissing} aria-pressed={onSelect ? focus === socket : undefined} aria-label={`${socketNames[socket]}：${item?.name ?? '未装备'}`}>
      <small>{socketNames[socket]}{auxiliary ? '格' : '槽'}</small><span className={s.socketSymbol}>{item?.symbol ?? '+'}</span><strong>{item?.name ?? (onSelect ? parentMissing ? '待解锁' : '点击装备' : '未装备')}</strong><span className={s.socketHint}>{socket === 'heart' ? heart ? '连接 2 个实际能力' : '先装备一部心法' : auxiliary ? item ? '仅影响所属分支' : '可放置 1 个辅助' : item ? '独立计时 · 共用供能' : onSelect ? '选择实际触发能力' : '没有连接能力'}</span>
    </button>;
  }
  const heartButton = socketButton('heart');
  const rows = abilities.map((ability) => {
    const abilityButton = socketButton(ability.id);
    const supportSocket: Socket = ability.id === 'melee' ? 'melee-support' : 'ranged-support';
    const supportButton = socketButton(supportSocket);
    const branch = state?.[ability.id];
    const missing = state ? Math.max(0, ability.cost - state.pool) : 0;
    const next = branch && state ? Math.max(0, branch.next - state.time) : 0;
    const interval = (ability.interval / 1000).toFixed(2);
    const cost = ability.cost.toFixed(1);
    const latest = state?.events.find((event) => event.kind === ability.id);
    const firing = state && latest ? state.time - latest.time < 350 : false;
    const waiting = ability.enabled && branch?.blocked;
    const status = !ability.enabled ? '未连接能力' : waiting ? `等待供能 · 还差 ${missing.toFixed(1)} 灵力` : firing ? '已触发' : `独立计时 · ${(next / 1000).toFixed(2)}s`;
    return <div className={s.connectionRow} key={ability.id} data-waiting={waiting || undefined}>
      <div className={s.branchSockets}>{abilityButton}<span className={s.socketLink}>＋</span>{supportButton}</div>
      {ability.enabled && <div className={s.branchFacts}><span>每 {interval}s 取用 <b>{cost}</b> 灵力</span><span>{ability.projectiles} 发 × {ability.damage} 伤害</span></div>}
      {state && <div className={s.branchStatus}><div><i className={firing ? s.firingDot : waiting ? s.waitingDot : s.idleDot} /><strong>{status}</strong><span>已触发 {branch?.count ?? 0} 次</span></div><progress max={1} value={ability.enabled ? 1 - next / ability.interval : 0} aria-label={`${ability.name}独立计时`} /></div>}
    </div>;
  });
  return <div className={s.connectionBoard}><div className={s.heartColumn}>{heartButton}<span className={s.flowLabel}>共享一个灵力池 →</span></div><div className={s.connectionBranches}>{rows}</div></div>;
}

export function CombatLab() {
  const [view, setView] = useState<'workshop' | 'arena'>('workshop');
  const [loadout, setLoadout] = useState<Loadout>({ ...initialLoadout });
  const [draft, setDraft] = useState<Loadout>({ ...initialLoadout });
  const [focus, setFocus] = useState<Socket>('heart');
  const initialConfig = toConfig(initialLoadout);
  const [state, setState] = useState<LabState>(() => { const initial = createLabState(initialConfig); return initial; });
  const [session, setSession] = useState(0);
  const config = toConfig(loadout);
  useEffect(() => {
    if (view !== 'arena') return;
    const activeConfig = toConfig(loadout);
    function tick() { setState((previous) => { const next = stepLab(previous, activeConfig); return next; }); }
    const timer = window.setInterval(tick, 50);
    return () => { window.clearInterval(timer); };
  }, [view, loadout]);

  function equip(id: string) {
    const next = { ...draft };
    if (focus === 'heart' || focus === 'melee' || focus === 'ranged') next[focus] = id;
    else if (focus === 'melee-support' && (id === 'power' || id === 'economy')) next.meleeSupport = id;
    else if (focus === 'ranged-support' && (id === 'multi' || id === 'economy')) next.rangedSupport = id;
    setDraft(next);
  }
  function unequip() {
    const next = { ...draft };
    if (focus === 'heart') { next.heart = null; next.melee = null; next.ranged = null; next.meleeSupport = 'none'; next.rangedSupport = 'none'; }
    if (focus === 'melee') { next.melee = null; next.meleeSupport = 'none'; }
    if (focus === 'ranged') { next.ranged = null; next.rangedSupport = 'none'; }
    if (focus === 'melee-support') next.meleeSupport = 'none';
    if (focus === 'ranged-support') next.rangedSupport = 'none';
    setDraft(next);
  }
  function enterArena() {
    const next = { ...draft };
    const nextConfig = toConfig(next);
    const initial = createLabState(nextConfig);
    setLoadout(next);
    setState(initial);
    setSession(session + 1);
    setView('arena');
  }
  function openWorkshop() { const next = { ...loadout }; setDraft(next); setView('workshop'); }
  function discard() { const next = { ...loadout }; setDraft(next); setView('arena'); }
  const active = view === 'workshop' ? draft : loadout;
  const activeConfig = toConfig(active);
  const abilities = getAbilities(activeConfig);
  const heart = hearts.find((item) => item.id === active.heart);
  const supply = heart ? heart.recoveryAmount * 1000 / heart.recoveryInterval : 0;
  const demand = abilities.reduce((total, ability) => total + (ability.enabled ? ability.cost * 1000 / ability.interval : 0), 0);
  const deficit = demand > supply;
  const selectedItem = getSocketItem(draft, focus);
  const inventory = getInventory(focus);
  const hasParent = focus === 'heart' || Boolean(draft.heart && (focus === 'melee-support' ? draft.melee : focus === 'ranged-support' ? draft.ranged : true));
  const canEnter = Boolean(draft.heart && (draft.melee || draft.ranged));
  const equipmentCards = inventory.map((item) => {
    const equipped = selectedItem?.id === item.id;
    return <button className={`${s.equipmentCard} ${equipped ? s.equipped : ''}`} key={item.id} onClick={() => { equip(item.id); }} disabled={!hasParent} aria-pressed={equipped}>
      <span className={s.itemSymbol}>{item.symbol}</span><span><strong>{item.name}</strong><small>{item.description}</small><em>{item.detail}</em></span><b>{equipped ? '已装备' : '装备 +'}</b>
    </button>;
  });
  const elapsed = (state.time / 1000).toFixed(1);
  const recent = state.events.slice(0, 8);
  const events = recent.map((event) => {
    const time = (event.time / 1000).toFixed(2);
    return <li key={event.id} data-kind={event.kind}><time>{time}s</time><span>{event.text}</span></li>;
  });
  const dps = state.time > 0 ? (state.damage * 1000 / state.time).toFixed(1) : '0.0';
  const recoveryCountdown = ((state.nextRecovery - state.time) / 1000).toFixed(2);

  return <main className={s.page}>
    <header className={s.heading}><div><span className={s.eyebrow}>秘境之间 / 心法构筑体验</span><h1>{view === 'workshop' ? '心法装配' : '试炼场'}</h1><p>{view === 'workshop' ? '以心法为源，连接你的近战技能、技能与辅助。' : '构筑已生效。自动攻击训练木桩，观察每条连接是否获得供能。'}</p></div><a href="#">返回游戏大厅 ↗</a></header>
    <div className={s.steps}><span className={view === 'workshop' ? s.currentStep : ''}>01 装备心法</span><i>→</i><span className={view === 'workshop' ? s.currentStep : ''}>02 连接能力与辅助</span><i>→</i><span className={view === 'arena' ? s.currentStep : ''}>03 返回试炼场观察</span></div>
    {view === 'workshop' ? <>
      <div className={s.workshopLayout}><section className={s.buildPanel}><div className={s.panelHeading}><div><span className={s.eyebrow}>YOUR BUILD</span><h2>心法连接图</h2></div><span className={s.badge}>{heart ? '2 个能力槽 · 每个能力 1 个辅助格' : '尚未装备心法'}</span></div><p className={s.instruction}>点击槽位，再从右侧选择物品。卸下能力会同时取下它的辅助。</p><ConnectionBoard loadout={draft} focus={focus} onSelect={setFocus} /><div className={s.legend}><span><i className={s.heartKey} />心法 / 供能</span><span><i className={s.abilityKey} />近战技能与技能 / 取能</span><span><i className={s.supportKey} />辅助 / 修饰所属能力</span></div></section>
      <aside className={s.inventory}><div className={s.panelHeading}><div><span className={s.eyebrow}>EQUIPMENT</span><h2>装备{socketNames[focus]}</h2></div>{selectedItem && <button className={s.textButton} onClick={unequip}>卸下{focus === 'heart' ? '整套连接' : ''}</button>}</div><p className={s.instruction}>{!hasParent ? '请先装备心法及所属能力。' : '点击物品，即可放入当前选中的槽位。'}</p><div className={s.equipmentList}>{equipmentCards}</div><div className={s.itemNote}>辅助只作用于连接它的近战技能或技能，不会影响另一条分支。当前物品为体验用配置。</div></aside></div>
      <section className={s.budget} data-deficit={deficit}><div><span className={s.eyebrow}>共享供能预览</span><h2>{!heart ? '从一部心法开始' : deficit ? '供能不足，能力会竞争灵力' : '平均供能足够，仍需留意瞬间消耗'}</h2><p>两条分支独立计时，却从同一个池子取能。某次攻击花掉的灵力，另一条分支就无法使用。</p></div><div className={s.budgetNumbers}><span>心法供给<strong>{supply.toFixed(1)}<small>灵力/秒</small></strong></span><b>↔</b><span>总满速需求<strong>{demand.toFixed(1)}<small>灵力/秒</small></strong></span></div></section>
      <footer className={s.actions}><div><strong>装配完成后进入试炼场，所有能力自动运行。</strong><small>每次确认装配开启新一轮试炼：灵力池满、攻速 1 倍。</small></div><div>{session > 0 && <button className={s.secondaryButton} onClick={discard}>放弃修改，继续观察</button>}<button className={s.primaryButton} onClick={enterArena} disabled={!canEnter}>确认装配 · 返回试炼场 →</button></div></footer>
    </> : <>
      <div className={s.testTop}><span className={s.liveBadge}><i />自动运行中 · {elapsed}s</span><button className={s.primaryButton} onClick={openWorkshop}>进入心法装配 ↗</button></div>
      <div className={s.testLayout}><section className={s.stagePanel}><Arena key={session} state={state} /><div className={s.stageFooter}><span>训练木桩 · 零防御 · 无需操作</span><strong>累计伤害 {state.damage.toFixed(0)} <small> / 平均 {dps}/秒</small></strong></div><div className={s.testResources}><article className={s.pool}><span>{heart?.name} · 灵力池</span><strong>{state.pool.toFixed(1)}<small> / {config.capacity}</small></strong><progress max={config.capacity} value={state.pool} aria-label="心法当前灵力" /><small>下次恢复 {recoveryCountdown}s · 每次 +{config.recoveryAmount}</small></article></div></section>
      <aside className={s.observation}><div className={s.panelHeading}><h2>触发观察</h2><span className={s.badge}>同一灵力池</span></div><p className={s.instruction}>进度条是各能力自己的计时；“等待供能”表示计时已到，但灵力不足。</p><ConnectionBoard loadout={loadout} state={state} /><div className={s.competitionNote} data-deficit={deficit}><strong>{deficit ? '总需求超过恢复速度' : '平均供给可覆盖需求'}</strong><p>供给 {supply.toFixed(1)}/秒 · 需求 {demand.toFixed(1)}/秒。池容量只能缓冲消耗，不能提高持续供给。</p></div></aside></div>
      <section className={s.log}><div className={s.panelHeading}><h2>最近发生了什么</h2><span className={s.badge}>恢复 → 取能 → 触发</span></div><ol>{events.length ? events : <li>能力正在独立计时，等待首次触发…</li>}</ol></section>
      <p className={s.bottomNote}>调整装备请进入心法装配。观察区只展示触发结果，不提供手动攻击、补能或参数修改。体验暂用：缺能时等待；同刻先恢复、再检查近战技能与技能。</p>
    </>}
    <p className={s.bottomNote}>本地构筑体验 · 不写入角色资产 · 心法与物品数值为示例，尚未接入正式多人战斗。</p>
  </main>;
}
