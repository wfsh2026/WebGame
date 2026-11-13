import { displayNumber as number, equipmentDescription } from '../hud/display-number';
import { WavePreparation } from './wave-preparation';
import { SkillPanel } from './skill-panel';
import { LevelRewards } from './level-rewards';
import { useEffect, useRef, useState } from 'react';
import type { BuildStateData, EquipmentLoadoutData, PlayerView, LootStateData, Snapshot } from '@web-game-world/contracts';
import { abilityGrowthSummary, trainingLabel, buildCatalog, itemAtLevel } from '@web-game-world/simulation';
import type { EquipmentItem } from '@web-game-world/simulation';
import content from '../network/content';
import { EquipmentIcon } from '../hud/equipment-icon';
import s from './build-panel.module.css';

interface BuildPanelProps { snapshot: Snapshot; waveReady: (ready: boolean) => void; remind: () => void; resting: boolean; loot: LootStateData; player?: PlayerView; discard: (id: string) => void; state: BuildStateData; error: string; choose: (choiceId: number, index: number, targetId?: string) => void; equip: (loadout: EquipmentLoadoutData, revision: number) => void }
const refineNames: Record<string, string> = { heart: '心法修习', weapon: '武器精修', skill: '术法研习', support: '宝石淬炼' };
const names = { heart: '心法', weapon: '近战武器', skill: '远程技能', support: '辅助宝石' };
export function BuildPanel(props: BuildPanelProps) {
  const [open, setOpen] = useState(false); const [tab, setTab] = useState<'level' | 'wave' | 'link' | 'equipment' | 'skills' | 'safe' | 'summary'>('level');
  const [focus, setFocus] = useState('');
  const [unseen, setUnseen] = useState<string[]>([]);
  const knownItems = useRef(new Set(props.state.items.map(item => item.id)));
  useEffect(() => {
    const added = props.state.items.filter(item => !knownItems.current.has(item.id));
    knownItems.current = new Set(props.state.items.map(item => item.id));
    const retained = new Set(props.state.items.map(item => item.id));
    setUnseen(previous => [...previous.filter(id => retained.has(id)), ...added.map(item => item.id)]);
  }, [props.state.items]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const previousRest = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const catalog = buildCatalog(content, props.state.items);
  
  useEffect(() => {
    function keyDown(event: KeyboardEvent): void {
      const element = event.target;
      if (event.repeat || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return;
      if (event.code !== 'KeyB' && event.code !== 'KeyK') return;
      event.preventDefault();
      if (open) setOpen(false); else reveal(event.code === 'KeyK' ? 'skills' : 'equipment');
    }
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [open, props.state.loadout]);
  const newestItem = catalog.find(item => item.id === unseen[unseen.length - 1]);
  const choice = props.state.choices.find(entry => entry.source === tab);
  useEffect(() => {
    const enteredRest = props.resting && !previousRest.current;
    const resumedCombat = !props.resting && previousRest.current;
    previousRest.current = props.resting;
    if (resumedCombat) { setOpen(false); return; }
    if (enteredRest && props.snapshot.preparation) { setTab('summary'); setOpen(true); }
    else if (open && (tab === 'level' || tab === 'wave' || tab === 'link') && !props.state.choices.some(entry => entry.source === tab)) {
      if (props.resting) setTab('summary'); else setOpen(false);
    }
  }, [props.state.choices, props.resting, open, tab, props.snapshot.preparation]);
  useEffect(() => {
    if (open) { dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [open]);
  function close(): void { if (props.resting && tab !== 'summary') setTab('summary'); else setOpen(false); }
  function closed(): void {
    setOpen(false);
    const canvas = document.querySelector<HTMLCanvasElement>('canvas');
    canvas?.focus({ preventScroll: true });
  }
  function reveal(next: 'level' | 'wave' | 'link' | 'equipment' | 'skills' | 'safe' | 'summary'): void { setTab(next); setOpen(true); }
  function viewed(id: string): void { setUnseen(previous => previous.filter(item => item !== id)); }
  function label(item: EquipmentItem): string { return `${item.name} · Lv.${item.level}（物品 ${item.baseLevel} + 临时 ${(item.level ?? 1) - (item.baseLevel ?? 1)}）`; }
  return <><nav className={s.launcher} aria-label="局内成长">{props.resting && <button onClick={() => reveal('summary')}>本波收获 · 准备 {props.snapshot.preparation?.readyIds.length ?? 0}/{props.snapshot.preparation?.participantIds.length ?? 0}</button>}<span>Lv.{props.state.level} · 经验 {props.state.experience}/{props.state.required}</span><button onClick={() => reveal('level')}>升级奖励 ×{props.state.upgradeCredits}{!props.resting && props.state.upgradeCredits > 0 ? ' · 休息时提示' : ''}</button><button onClick={() => reveal('wave')}>波次奖励 ×{props.state.waveCredits}</button>{props.state.choices.some(entry => entry.source === 'link') && <button onClick={() => reveal('link')}>开槽 · 配套奖励</button>}<button onClick={() => reveal('skills')}>本局构筑 · K{unseen.length > 0 ? ` · 新物品 ×${unseen.length}` : ''}</button><button data-loot-target="bag" onClick={() => reveal('equipment')}>背包 · 本局可用 {props.state.items.length}</button><button data-loot-target="safe" onClick={() => reveal('safe')}>保险箱 · 可带出 {props.loot.safe.length}</button></nav>
    {unseen.length > 0 && <button className={s.newBuildItem} onClick={() => { setFocus(unseen[unseen.length - 1]); reveal('skills'); }}>{newestItem?.name ?? '新构筑物品'}已入储备 · 点击装配</button>}
    <dialog ref={dialog} className={s.dialog} data-level={tab === 'level'} aria-label={tab === 'level' ? '选择本次成长' : '本次秘境构筑'} onCancel={event => { event.preventDefault(); close(); }} onClose={closed}>
      {tab === 'level' && choice && <LevelRewards key={choice.id} state={props.state} choice={choice} player={props.player} error={props.error} choose={props.choose} close={close} />}
      {tab === 'level' && !choice && <section className={s.empty}><h2>暂无待选成长</h2><p>击杀与助攻可获得经验，升级后选择本次成长。</p><button onClick={close}>返回战斗</button></section>}
      {props.resting && tab === 'level' && <nav><button onClick={() => reveal('summary')}>返回本波收获</button>{props.player && props.snapshot.preparation?.readyIds.includes(props.player.id) && <button onClick={() => props.waveReady(false)}>取消准备</button>}</nav>}
      {tab !== 'level' && <>
      <header><div><h2>{tab === 'summary' ? '本波收获' : tab === 'wave' ? choice?.keyWave ? '关键波次 · 构筑突破' : '波次收获 · 补全构筑' : '本次秘境构筑'}</h2><small>{props.resting ? '准备阶段 · 全员准备后倒计时开战。' : '战斗持续进行；关闭后恢复操作。临时强化和装配仅本局有效。'}</small></div><button onClick={close}>收起，稍后选择</button></header>
      <nav>{props.resting && <button onClick={() => reveal('summary')}>收获与准备</button>}<button onClick={() => setTab('level')}>等级成长 · {props.state.upgradeCredits}</button><button onClick={() => setTab('wave')}>波次收获 · {props.state.waveCredits}</button><button onClick={() => setTab('link')}>配套奖励</button><button onClick={() => reveal('skills')}>技能构筑</button><button onClick={() => setTab('equipment')}>背包储备</button></nav>
      {props.error && <p role="alert">{props.error}</p>}
      {tab !== 'equipment' && tab !== 'safe' && tab !== 'skills' && tab !== 'summary' && <section><p>{tab === 'link' ? '能力槽已解锁：5/10/15/20级各有一次配套选择。领取后进入储备，请在技能面板中装备；不会覆盖现有能力。' : '物品进入局内储备，指定强化只在本局生效。灵魂状态也可领取；波次金币在最终结算发放。'}</p>
        {choice?.source === 'wave' && <p className={s.waveLabel}>第 {choice.wave} 波 · {choice.keyWave ? '关键奖励：补足缺口 / 高等级物品 / 指定强化' : '普通奖励：可用物品与构筑选择'} · 待选 {props.state.waveCredits} 次</p>}
        {choice ? <div className={s.choices}>{choice.options.map((option, index) => {
          const cardId = `${choice.id}-${index}`;
          if (option.kind === 'refine') {
            const eligible = catalog.filter(item => item.kind === option.itemId && (item.level ?? 1) < 20);
            const selectedId = targets[cardId] ?? eligible[0]?.id ?? '';
            const target = eligible.find(item => item.id === selectedId);
            const targetGrowth = target ? abilityGrowthSummary(target) : '';
            const targetLevel = (target?.level ?? 1) + 1;
            return <article className={s.rewardCard} key={cardId}><small>指定类别强化 · 仅本局生效</small><b>{refineNames[option.itemId] ?? '构筑强化'}</b>{target && <EquipmentIcon kind={target.kind} effect={target.effect} />}<p>从已装备物品或储备中选择一件，10级前提升1级，10级起增加100修习经验。</p><label>选择强化目标<select value={selectedId} onChange={event => { const value = event.target.value; setTargets(previous => ({ ...previous, [cardId]: value })); }}>{eligible.map(item => <option key={item.id} value={item.id}>{label(item)}</option>)}</select></label>{target && <p>{targetGrowth}<br />{target.name}：{trainingLabel(target)}{target.kind !== 'support' && ((target.level ?? 1) < 10 && targetLevel === 5) ? ' · 解锁新槽位' : ''}</p>}<button onClick={() => props.choose(choice.id, index, selectedId)}>{target ? '确认强化' : '刷新已失效选项'}</button></article>;
          }
          const item = option.kind === 'upgrade' ? catalog.find(entry => entry.id === option.itemId) : content.equipmentDefinitions.find(entry => entry.id === option.itemId);
          if (!item) return null;
          const desiredLevel = option.kind === 'upgrade' ? (item.level ?? 1) + 1 : option.level;
          const definitionId = item.definitionId ?? item.id;
          const definition = content.equipmentDefinitions.find(entry => entry.id === definitionId) ?? item;
          const preview = itemAtLevel(definition, desiredLevel);
          const title = option.kind === 'upgrade' ? `${item.name} → Lv.${desiredLevel}` : `${item.name} · 物品 Lv.${option.level}`;
          const unlock = item.kind === 'support' ? '辅助仅修饰所属能力' : item.kind === 'heart' ? `能力槽 ${preview.slots} 个` : `辅助槽 ${preview.supportSlots} 个`;
          const growthSummary = abilityGrowthSummary(preview);
          const supply = item.kind === 'heart' ? (preview.recovery / preview.interval).toFixed(1) : '';
          return <article className={s.rewardCard} key={cardId}><EquipmentIcon kind={item.kind} effect={item.effect} /><small>{option.kind === 'upgrade' ? '局内临时升级' : '获得物品 · 放入储备'} · {names[item.kind]}</small><b>{title}</b><p>{equipmentDescription(item)}</p><strong>{growthSummary}</strong><p>{unlock}</p>{item.kind === 'heart' && <p>容量 {number(preview.capacity)} · 平均供能 {supply}/秒<br />每次恢复消耗 {number(preview.manaCost)} 魔法</p>}{(item.kind === 'weapon' || item.kind === 'skill') && <p>基础耗能 {number(preview.cost)} · 基础间隔 {number(preview.interval)} 秒<br />辅助与角色速度会改变最终需求</p>}<button onClick={() => props.choose(choice.id, index)}>{option.kind === 'upgrade' ? '选择升级' : '领取到局内储备'}</button></article>;
        })}</div> : <p>暂无待选奖励。击杀和助攻获得经验，推进波次获得物品选择；心法首次达到5、10、15、20级时获得配套奖励。</p>}</section>}
      {tab === 'summary' && <WavePreparation snapshot={props.snapshot} state={props.state} player={props.player} unseen={unseen.length} ready={props.waveReady} remind={props.remind} open={reveal} />}
      {tab === 'safe' && <section><h2>保险箱 · 本局不可使用</h2><p>拾取后直接封存，正常任务失败结算后进入大厅仓库；不能转入本局背包。</p>{props.loot.safe.length === 0 && <p>暂无可带出战利品。</p>}<div className={s.choices}>{props.loot.safe.map(item => <article className={s.rewardCard} key={item.id}><EquipmentIcon kind={item.kind} effect={item.effect} /><b>{item.name} · Lv.{item.level}</b><small>来自第 {item.wave} 波 · 已存入保险箱</small></article>)}</div></section>}
      {(tab === 'skills' || tab === 'equipment') && <SkillPanel state={props.state} player={props.player} focus={focus} unseen={unseen} viewed={viewed} discard={props.discard} equip={props.equip} />}
      </>}
    </dialog></>;
}
