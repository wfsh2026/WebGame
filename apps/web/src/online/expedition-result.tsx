import type { PersonalReward, RoundResult } from '@web-game-world/contracts';
import { BattlePortrait } from '../hud/combat-hud';
import { formatTime } from './survival-overlay';
import s from './expedition-result.module.css';

interface ResultProps { playerId: string; name: string; results: RoundResult[]; reward?: PersonalReward; busy: boolean; error: string; onClose: () => Promise<void> }
export function ExpeditionResult(props: ResultProps) {
  let seconds = 0; let kills = 0; let assists = 0; let waves = 0;
  for (const result of props.results) {
    const personal = result.players.find(player => player.id === props.playerId);
    seconds += personal?.survivalSeconds ?? 0; kills += personal?.kills ?? 0; assists += personal?.assists ?? 0;
    if (result.success) waves += 1;
  }
  const lastPersonal = props.results.at(-1)?.players.find(player => player.id === props.playerId);
  const safe = lastPersonal?.safe ?? [];
  const time = formatTime(seconds); const last = props.results.at(-1)?.round ?? 0;
  return <main className={s.page}><section className={s.card} role="dialog" aria-modal="true" aria-labelledby="result-title">
    <div className={s.identity}><BattlePortrait /><span>{props.name}</span></div><h1 id="result-title">任务失败</h1><p className={s.subtitle}>全员进入灵魂 · 个人最终结算</p>
    <div className={s.rounds}><div className={s.round}><b>抵达第 {last} 波</b><strong>{time}</strong><span>含灵魂期间的生存时间</span><small>击杀 {kills} · 助攻 {assists} · 波次奖励 {waves} 次</small></div></div>
    {props.reward ? <div className={s.rewards}><span>金币<strong>+{props.reward.coins}</strong></span><span>经营素材<strong>+{props.reward.materials}</strong></span></div> : <p role="status">正在读取个人奖励…</p>}
    <section><h2>保险箱 · 带回大厅 {safe.length} 件</h2>{safe.map(item => <p key={item.id}>{item.name} · Lv.{item.level}</p>)}<p>背包中的消耗品、本局限定物品与临时强化已随本局结束清除。</p></section>
    {props.error && <p role="alert">{props.error}</p>}<button autoFocus onClick={props.onClose} disabled={props.busy || !props.reward}>{props.busy ? '正在返回…' : '关闭结算并返回游戏大厅'}</button>
  </section></main>;
}
