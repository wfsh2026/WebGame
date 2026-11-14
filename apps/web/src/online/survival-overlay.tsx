import { useEffect, useRef, useState } from 'react';
import s from './survival-overlay.module.css';
import { expeditionDifficulties, hellRewardMultiplier, waveProfile } from '@web-game-world/simulation';
import type { ExpeditionViewData, SpawnWarningView, WavePreparation, WavePlansView } from '@web-game-world/contracts';
import { WaveLineup } from './wave-lineup';
import { HudIcon } from '../hud/hud-icon';
import content from '../network/content';

export function formatTime(seconds: number): string {
  const ceiling = Math.ceil(seconds); const rounded = Math.max(0, ceiling);
  const minutes = Math.floor(rounded / 60); const remainder = rounded % 60;
  const first = String(minutes); const second = String(remainder);
  const minuteText = first.padStart(2, '0'); const secondText = second.padStart(2, '0');
  return `${minuteText}:${secondText}`;
}

interface SurvivalProps { expedition?: ExpeditionViewData; coins?: number; plans?: WavePlansView; preparation?: WavePreparation; enemies: number; warnings: SpawnWarningView[]; pending: number; round: number; seconds: number; survived: number; resting: boolean; living: number; total: number }
export function SurvivalOverlay(props: SurvivalProps) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null); const lastAlert = useRef('');
  const remaining = formatTime(props.seconds); const elapsed = formatTime(props.survived);
  const config = { ...content, difficulty: props.expedition?.difficulty ?? 'normal' };
  const context = { config }; const current = waveProfile(context, props.round);
  const nextRound = props.round + 1; const next = waveProfile(context, nextRound);
  const currentPlan = props.plans?.current?.round === props.round ? props.plans.current : undefined;
  const nextPlan = props.plans?.next?.round === nextRound ? props.plans.next : undefined;
  const currentName = currentPlan?.name ?? current.wave.name; const nextName = nextPlan?.name ?? next.wave.name;
  const difficulty = expeditionDifficulties[props.expedition?.difficulty ?? 'normal'].name;
  const floor = props.expedition?.hellFloor ?? 0;
  const title = floor ? currentName : `第 ${props.round} ${props.expedition ? '关' : '波'} · ${currentName}`;
  const phase = props.expedition ? floor ? `${difficulty} · ${floor}/20层` : `${difficulty} · ${props.round}/20关` : `循环 ${current.stage}`;
  const multiplier = hellRewardMultiplier(floor + 1);
  const solo = props.preparation ? props.preparation.participantIds.length === 1 : props.total === 1;
  const preparation = solo ? '休息中 · 可开始下一关' : `准备 ${props.preparation?.readyIds.length ?? 0}/${props.preparation?.participantIds.length ?? 0}`;
  const clock = props.preparation ? props.preparation.countdown > 0 ? `${remaining} 后开战` : preparation : props.resting ? preparation : props.seconds > 0 ? `${props.expedition ? '关卡剩余' : '增援剩余'} ${remaining}` : '正在清场';
  useEffect(() => {
    const panel = dialog.current;
    if (scheduleOpen && panel && !panel.open) panel.showModal();
    else if (!scheduleOpen && panel?.open) panel.close();
  }, [scheduleOpen]);
  useEffect(() => {
    if (!props.preparation || props.preparation.countdown <= 0) return;
    const key = `${props.round}:next`; if (lastAlert.current === key) return; lastAlert.current = key;
    if (typeof AudioContext === 'undefined') return;
    const audio = new AudioContext();
    if (audio.state !== 'running') { void audio.close(); return; }
    const oscillator = audio.createOscillator(); const gain = audio.createGain();
    oscillator.frequency.value = next.wave.guarantee === 'boss' ? 220 : 440; gain.gain.value = .035;
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start();
    const end = audio.currentTime + .18; oscillator.stop(end);
    oscillator.onended = () => { void audio.close(); };
  }, [props.round, props.preparation, next.wave.guarantee]);
  function close(): void {
    setScheduleOpen(false);
    const canvas = document.querySelector<HTMLCanvasElement>('canvas'); canvas?.focus({ preventScroll: true });
  }
  return <>
    <section className={s.heading} aria-label="当前战况"><h1 title={title}><span>{title}</span></h1><div className={s.information}><p>{phase} <span>·</span> {clock}</p><p>场上 {props.enemies} <span>·</span> 待入场 {props.pending}</p></div></section>
    <aside className={s.rightPanel}><button className={s.launcher} onClick={() => setScheduleOpen(true)} aria-haspopup="dialog" aria-expanded={scheduleOpen}><HudIcon name="schedule" size={34} />波次情报</button><p className={s.next}><span className={s.elapsed}>历时 {elapsed}</span></p></aside>
    {props.living === 1 && props.total > 1 && <p className={s.lastSurvivor} role="status">仅剩一名存活者 · 等待队友复活</p>}
    <dialog ref={dialog} className={s.dialog} aria-label="波次情报" onCancel={close} onClose={close}>
      <header><h2>波次情报</h2><button onClick={close} aria-label="关闭波次情报">×</button></header>
      <p>{phase} · 当前：{currentName}</p><p>{currentPlan?.hint ?? current.wave.hint}</p><WaveLineup plan={currentPlan} />
      <h3>下一{props.expedition ? '关' : '波'} · {nextName}</h3><p>{nextPlan?.hint ?? next.wave.hint}</p><WaveLineup plan={nextPlan} />
      <button onClick={() => setTimelineOpen(!timelineOpen)} aria-expanded={timelineOpen}>{timelineOpen ? '收起关卡编排' : '查看关卡编排'}</button>
      {timelineOpen && <><ol className={s.cycle}>{content.waves?.map((wave, index) => <li key={index} aria-current={current.position === index + 1 ? 'step' : undefined}>{index + 1} · {wave.name} · {wave.interval}秒</li>)}</ol><WaveLineup plan={currentPlan} timeline /></>}
      {props.expedition && <p>{floor ? `地狱共20层，每层最多60秒，清空全部敌人可提前过关。下一层收益${multiplier}倍。` : '基础共20关，计时结束后清理剩余怪物并进入休息；第20关判定胜利。'}</p>}
      <p>待提取金币 {props.coins ?? 0} · {floor ? '地狱全队失败会失去本次全部待提取收益，层间可提取返回。' : '收益在结算后按当前秘境规则处理。'}</p>
    </dialog>
  </>;
}
