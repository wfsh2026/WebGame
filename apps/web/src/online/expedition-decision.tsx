import { useEffect, useState } from 'react';
import type { ExpeditionActionData, Snapshot } from '@web-game-world/contracts';
import { expeditionDifficulties, hellRewardMultiplier } from '@web-game-world/simulation';
import s from './reward-ui.module.css';
import w from './wave-rewards.module.css';

interface DecisionProps { snapshot: Snapshot; playerId: string; coins: number; items: number; error?: string; disabled?: boolean; choose: (data: ExpeditionActionData) => void; onBusyChange?: (busy: boolean) => void }

export function ExpeditionDecision(props: DecisionProps) {
  const expedition = props.snapshot.expedition;
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState(false);
  const continued = expedition?.continuedIds.includes(props.playerId) ?? false;
  useEffect(() => { setPending(false); }, [expedition?.saving, continued, props.error]);
  useEffect(() => { props.onBusyChange?.(pending); }, [pending, props.onBusyChange]);
  useEffect(() => () => props.onBusyChange?.(false), [props.onBusyChange]);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => { setPending(false); setRetry(true); }, 8000);
    return () => window.clearTimeout(timer);
  }, [pending]);
  if (!expedition?.decision) return null;
  const gifts = expedition.gifts[props.playerId] ?? 0;
  const setting = expeditionDifficulties[expedition.difficulty];
  const floor = expedition.hellFloor;
  const next = floor + 1;
  const multiplier = hellRewardMultiplier(next);
  const disabled = pending || expedition.saving || props.disabled;
  function choose(action: ExpeditionActionData['action']): void {
    if (disabled) return;
    const request: ExpeditionActionData = { round: props.snapshot.round, action, acceptRisk: action === 'continue' && floor === 0 };
    setPending(true); setRetry(false); props.choose(request);
  }
  return <section className={w.decisionContent} aria-label="提取或继续挑战">
    {continued ? <><h2>已选择继续挑战</h2><p>{gifts > 0 ? `领取剩余 ${gifts} 次入场赠送成长后，整理构筑并准备。` : '整理构筑，队伍全部准备后出发。'}</p></> : <>
      <small>{setting.name} · {floor ? `地狱${floor}层已通过` : '20关胜利'}</small><h2>{floor ? '提取收益，还是继续？' : '通关成功 · 地狱挑战已开启'}</h2>
      <div className={w.decisionBalance}><span>当前待提取<strong>{props.coins}<small> 金币</small></strong></span><span>可带出物品<strong>{props.items}<small> 件</small></strong></span></div>
      <p className={w.risk}>继续挑战后，全队失败将失去本次冒险全部待提取收益，包含基础20关奖励{props.items > 0 && '与保险箱物品'}。</p>
      <p>下一关：{setting.name} · 地狱 {next} 层 · 收益 {multiplier} 倍</p><p>最多60秒，清空全部敌人或坚持到结束均可过关。</p>{floor === 0 && <p>入场赠送 <b>5 次三选一</b>，保留本局构筑与成长。</p>}<p>每层结束可以提取离开，第20层通过后完成地狱挑战。</p>
      {expedition.saving && <p role="status">正在保存当前关卡成果…</p>}{(props.error || retry) && <p className={w.warning} role="alert">{props.error || '尚未收到确认，可重试本次选择'}</p>}
      <div className={w.decisionActions}><button className={s.select} disabled={disabled} onClick={() => choose('extract')}>{pending ? '正在确认…' : '提取收益并返回'}</button><button className={s.select} disabled={disabled} onClick={() => choose('continue')}>{pending ? '正在确认…' : floor ? `继续地狱${next}层` : '承担风险，进入地狱'}</button></div>
    </>}
  </section>;
}
