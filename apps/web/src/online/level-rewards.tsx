import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { BuildStateData, PlayerView, RefreshGrowthData } from '@web-game-world/contracts';
import { GrowthRefresh } from './growth-refresh';
import { RewardCards } from './reward-cards';
import { useTutorial } from './tutorial/tutorial-context';
import { TutorialHint } from './tutorial/tutorial-ui';
import g from './tutorial/tutorial.module.css';
import s from './level-rewards.module.css';

type Choice = BuildStateData['choices'][number];
interface RewardProps { state: BuildStateData; choice: Choice; player?: PlayerView; error: string; disabled?: boolean; groups?: ReactNode; choose: (id: number, index: number, targetId?: string) => void; refresh: (data: RefreshGrowthData) => void; onBusyChange: (busy: boolean) => void }

export function LevelRewards(props: RewardProps) {
  const guide = useTutorial();
  const teaching = guide.active && !guide.data?.milestones.includes('reward');
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [localError, setLocalError] = useState('');
  const wave = props.choice.wave ? `第 ${props.choice.wave} 波奖励` : '波次奖励';
  const source = props.choice.hellEntry ? '地狱入场 · 赠送成长' : props.choice.source === 'level' ? `等级成长 · Lv.${props.choice.earnedLevel ?? props.state.level}` : props.choice.source === 'wave' ? `${wave}${props.choice.keyWave ? ' · 关键奖励' : ''}` : '构筑奖励';
  const busy = pending || refreshing;
  useEffect(() => { if (props.error) setPending(false); }, [props.error]);
  useEffect(() => { props.onBusyChange(busy); }, [busy, props.onBusyChange]);
  useEffect(() => () => props.onBusyChange(false), [props.onBusyChange]);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => { setPending(false); setRetry(true); }, 8000);
    return () => window.clearTimeout(timer);
  }, [pending]);
  function choose(index: number, targetId?: string): void {
    if (busy || props.disabled) return;
    setPending(true); setRetry(false); setLocalError('');
    try { props.choose(props.choice.id, index, targetId); }
    catch (cause) { const message = cause instanceof Error ? cause.message : '选择未完成，请重试'; setLocalError(message); setPending(false); }
  }
  const error = props.error || localError || (retry ? '尚未收到确认，可重试本次选择' : '');
  return <section className={s.panel} aria-label="选择奖励">
    <TutorialHint show={teaching} title="选择一项奖励，强化当前构筑">升级与新物品的变化可在本局构筑中查看。</TutorialHint>
    <div className={s.toolbar}>{props.groups}<GrowthRefresh state={props.state} choice={props.choice} error={props.error} refresh={props.refresh} disabled={pending || props.disabled} onBusyChange={setRefreshing} /></div>
    <p className={s.source}>{source}</p>
    <div className={teaching && guide.expanded && !busy ? g.target : undefined}><RewardCards key={`${props.choice.id}-${props.choice.refreshCount ?? 0}`} state={props.state} choice={props.choice} player={props.player} busy={pending} disabled={refreshing || props.disabled} choose={choose} /></div>
    {error && <p className={s.error} role="alert">{error}</p>}
  </section>;
}
