import { useEffect, useRef, useState } from 'react';
import s from './survival-overlay.module.css';
import { waveProfile } from '@web-game-world/simulation';
import type { SpawnWarningView, WavePreparation } from '@web-game-world/contracts';
import content from '../network/content';

export function formatTime(seconds: number): string {
  const ceiling = Math.ceil(seconds); const rounded = Math.max(0, ceiling);
  const minutes = Math.floor(rounded / 60); const remainder = rounded % 60;
  const minuteText = String(minutes); const secondText = String(remainder);
  const first = minuteText.padStart(2, '0'); const second = secondText.padStart(2, '0');
  return `${first}:${second}`;
}

interface SurvivalProps { preparation?: WavePreparation; enemies: number; warnings: SpawnWarningView[]; pending: number; round: number; seconds: number; survived: number; resting: boolean; living: number; total: number }
export function SurvivalOverlay(props: SurvivalProps) {
  const [rewardOpen, setRewardOpen] = useState(false);
  useEffect(() => {
    setRewardOpen(false);
  }, [props.round]);
  const remaining = formatTime(props.seconds); const elapsed = formatTime(props.survived);
  const context = { config: content }; const current = waveProfile(context, props.round);
  const nextRound = props.round + 1; const afterRound = props.round + 2;
  const next = waveProfile(context, nextRound); const after = waveProfile(context, afterRound);
  const elitePercent = (current.elite * 100).toFixed(1); const bossPercent = (current.boss * 100).toFixed(2);
  const guarantee = current.wave.guarantee === 'boss' ? '本波 Boss 必出' : current.wave.guarantee === 'elite' ? '本波精英必出' : current.boss > 0 ? '本波可能出现 Boss' : '本波不刷新 Boss';
  const completed = props.resting ? props.round : props.round - 1;
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const lastAlert = useRef('');
  useEffect(() => {
    if (!props.preparation || props.preparation.countdown <= 0) return;
    const key = `${props.round}:next`; if (lastAlert.current === key) return; lastAlert.current = key;
    if (typeof AudioContext === 'undefined') return;
    const audio = new AudioContext();
    if (audio.state !== 'running') { void audio.close(); return; }
    const oscillator = audio.createOscillator(); const gain = audio.createGain();
    const frequency = next.wave.guarantee === 'boss' ? 220 : 440;
    oscillator.frequency.value = frequency; gain.gain.value = .035;
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start();
    const end = audio.currentTime + .18; oscillator.stop(end);
    oscillator.onended = () => { void audio.close(); };
  }, [props.round, props.seconds, props.preparation, next.wave.guarantee]);
  return <><div className={s.heading}><b>阶段 {current.stage} · 第 {props.round} 波</b><span>{current.wave.name}</span><strong>{props.preparation ? props.preparation.countdown > 0 ? `${remaining} 后开战` : `准备 ${props.preparation.readyIds.length}/${props.preparation.participantIds.length}` : props.seconds > 0 ? `增援剩余 ${remaining}` : `清理剩余怪物 ${props.enemies}`}</strong><span>{props.resting ? '波次准备 · 全员确认后继续' : `存活 ${props.living} / ${props.total} · 场上 ${props.enemies} · 待入场 ${props.pending}`}</span></div>
    <div className={s.rightPanel}><aside className={s.reward}><button className={s.compact} onClick={() => setRewardOpen(!rewardOpen)} aria-expanded={rewardOpen}>历时 {elapsed} · 波次奖励 {completed} 次</button>
      {rewardOpen && <section className={s.details} role="status"><h3>波次收益已累计</h3><p>波次金币 <b>+{completed * 10}</b></p><p>失败后统一结算。灵魂在战斗期间继续累计收益，准备时间不计入。</p><button onClick={() => setRewardOpen(false)}>收起</button></section>}
      {props.living === 1 && props.total > 1 && <section className={s.details}><strong>仅剩一名存活者</strong><p>坚持到队友复活，全员灵魂将立即失败。</p></section>}
    </aside>
    <aside className={s.schedule} aria-label="波次预告">
      <b>{guarantee}</b><p>{current.wave.hint}</p>
      <p className={props.preparation?.countdown ? s.imminent : undefined}>下一波：{next.wave.name} · {props.preparation?.countdown ? `${remaining} 后开战` : '清场并全员准备后开始'}</p><small>随后：{after.wave.name}</small>
      {props.warnings.map((warning, index) => {
        const enemy = content.enemies.find(item => item.kind === warning.kind);
        const seconds = Math.ceil(warning.seconds);
        return warning.kind ? <p className={s.imminent} key={`${warning.wave}:${index}`} role="alert">{warning.kind.endsWith('-boss') ? '首领' : '精英'} {enemy?.name ?? warning.kind} · {seconds > 0 ? `${seconds} 秒后入场` : '即将入场'} · 留意地面裂隙预警</p> : null;
      })}
      <button onClick={() => setScheduleOpen(!scheduleOpen)} aria-expanded={scheduleOpen}>{scheduleOpen ? '收起阶段详情' : '查看十波节奏与概率'}</button>
      {scheduleOpen && <div><ol className={s.cycle}>{content.waves?.map((wave, index) => <li key={index} aria-current={current.position === index + 1 ? 'step' : undefined}>{index + 1} · {wave.name}</li>)}</ol><p>精英 {elitePercent}% · Boss {bossPercent}%</p><small>达到本波 1 只 Boss 上限前的单次概率；第 5 波精英、第 10 波 Boss 保底。增援结束并清场后进入准备阶段。</small></div>}
    </aside></div></>;
}
