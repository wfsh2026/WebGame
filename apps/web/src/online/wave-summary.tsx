import { useState } from 'react';
import type { BuildStateData, LootStateData, Snapshot } from '@web-game-world/contracts';
import { RewardDialog } from './reward-dialog';
import w from './wave-rewards.module.css';

interface Props { state: BuildStateData; snapshot: Snapshot; loot: LootStateData; playerId: string; remaining: number; resting: boolean }

export function WaveSummary(props: Props) {
  const [detail, setDetail] = useState('');
  const personal = props.snapshot.results.find(result => result.round === props.snapshot.round)?.players.find(player => player.id === props.playerId);
  const earlier = props.snapshot.results.filter(result => result.round < props.snapshot.round);
  const previous = earlier.at(-1)?.players.find(player => player.id === props.playerId);
  const knownIncome = personal?.coinsEarned !== undefined && (props.snapshot.round === 1 || previous?.coinsEarned !== undefined);
  const income = knownIncome ? Math.max(0, (personal?.coinsEarned ?? 0) - (previous?.coinsEarned ?? 0)) : undefined;
  const balance = Math.max(0, props.state.coinsEarned - props.state.coinsSpent);
  const previousIds = previous?.safe?.map(item => item.id) ?? [];
  const newSafe = (personal?.safe ?? []).filter(item => !previousIds.includes(item.id));
  function close(): void { setDetail(''); }
  return <>
    <div className={w.summary}><button onClick={() => setDetail('record')} aria-label="查看本波收益与战绩"><i className={w.coin} />{props.resting ? '本波金币' : '本局金币'} <b>{props.resting ? income === undefined ? '同步中' : `+${income}` : balance}</b> ›</button><span>本局 <b>Lv.{props.state.level}</b></span><button onClick={() => setDetail('safe')}>保险箱 <b>{props.loot.safe.length}</b> 件 ›</button><span>待选奖励 <b>{props.remaining}</b> 次</span></div>
    {detail === 'safe' && <RewardDialog title="保险箱收益" close={close}>{props.loot.safe.length ? props.loot.safe.map(item => <p key={item.id}>{item.name} · Lv.{item.level}<small>　第 {item.wave} 波获得</small></p>) : <p>暂未获得可带出物品。</p>}<p>待本局个人结算后按秘境规则带回大厅。</p></RewardDialog>}
    {detail === 'record' && <RewardDialog title={`第 ${props.snapshot.round} 波 · 收益与战绩`} close={close}>{personal ? <><p>本波金币收入 {income === undefined ? '同步中' : `+${income}`} · 本局可用 {balance}</p><p>击杀 {personal.kills} · 助攻 {personal.assists ?? 0}</p><p>造成伤害 {personal.damage} · 生存 {personal.survivalSeconds ?? 0} 秒</p><p>保险箱：本波新增 {newSafe.length} 件，本局累计 {props.loot.safe.length} 件。</p></> : <p>本波成果尚未同步，完成后自动更新。</p>}</RewardDialog>}
  </>;
}
