import type { ExpeditionViewData, PersonalReward, RoundResult } from '@web-game-world/contracts';
import { expeditionDifficulties } from '@web-game-world/simulation';
import { BattlePortrait } from '../hud/combat-hud';
import { formatTime } from './survival-overlay';
import s from './expedition-result.module.css';
import { useTutorial } from './tutorial/tutorial-context';
import { TutorialCard } from './tutorial/tutorial-ui';
import g from './tutorial/tutorial.module.css';

interface ResultProps { expedition?: ExpeditionViewData; playerId: string; name: string; results: RoundResult[]; reward?: PersonalReward; busy: boolean; error: string; onClose: () => Promise<void> }
export function ExpeditionResult(props: ResultProps) {
  const guide = useTutorial();
  let seconds = 0; let kills = 0; let assists = 0; let waves = 0;
  for (const result of props.results) {
    const personal = result.players.find(player => player.id === props.playerId);
    seconds += personal?.survivalSeconds ?? 0; kills += personal?.kills ?? 0; assists += personal?.assists ?? 0;
    if (result.success && personal) waves += 1;
  }
  const personalResults = props.results.filter(result => result.players.some(player => player.id === props.playerId));
  const lastResult = personalResults.at(-1); const lastPersonal = lastResult?.players.find(player => player.id === props.playerId);
  const hellFailed = props.reward?.outcome === 'failed' && props.reward.baseCleared;
  const safe = hellFailed ? [] : lastPersonal?.safe ?? [];
  const time = formatTime(seconds); const last = lastResult?.round ?? 0;
  const difficulty = expeditionDifficulties[props.expedition?.difficulty ?? 'normal'].name;
  const title = props.reward?.outcome === 'hell-victory' ? '地狱20层通关' : hellFailed ? '地狱挑战失败' : props.reward?.outcome === 'extracted' ? '收益已安全提取' : '挑战结束';
  const progress = last > 20 ? `完成地狱${props.reward?.hellFloor ?? 0}层` : `抵达第${last}/20关`;
  return <main className={s.page}><section className={s.card} role="dialog" aria-modal="true" aria-labelledby="result-title">
    <div className={s.identity}><BattlePortrait /><span>{props.name}</span></div><h1 id="result-title">{title}</h1><p className={s.subtitle}>{difficulty} · {props.reward?.baseCleared ? '基础20关已通关' : '基础关卡挑战'} · 个人最终结算</p>
    <div className={s.rounds}><div className={s.round}><b>{progress}</b><strong>{time}</strong><span>含灵魂期间的生存时间</span><small>击杀 {kills} · 助攻 {assists} · 过关 {waves} 次</small></div></div>
    {props.reward ? <div className={s.rewards}><span>带回金币<strong>+{props.reward.coins}</strong></span><span>本局获得<strong>{props.reward.earned ?? props.reward.coins}</strong></span><span>刷新消耗<strong>{props.reward.spent ?? 0}</strong></span></div> : <p role="status">正在读取个人奖励…</p>}
    {hellFailed && <p role="alert">地狱失败，本次冒险全部待提取收益已丢失：金币 {props.reward?.lost ?? 0}，可带出物品不予发放。基础通关记录保留。</p>}
    <section><h2>保险箱 · 带回大厅 {safe.length} 件</h2>{safe.map(item => <p key={item.id}>{item.name} · Lv.{item.level}</p>)}<p>背包中的消耗品、本局限定物品与临时强化已随本局结束清除。</p></section>
    {props.reward && guide.active && <TutorialCard title="返回营地，提升角色成长" text="首次冒险已结束。金币可用于角色升级，获得的成长点需要分配并保存。" step={5} />}
    {props.error && <p role="alert">{props.error}</p>}<button className={props.reward && guide.expanded ? g.target : undefined} autoFocus onClick={props.onClose} disabled={props.busy || !props.reward}>{props.busy ? '正在返回…' : '关闭结算并返回游戏大厅'}</button>
  </section></main>;
}
