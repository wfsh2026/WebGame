import { useEffect, useRef, useState } from 'react';
import type { BuildStateData, RefreshGrowthData } from '@web-game-world/contracts';
import { growthRefreshPrices } from '@web-game-world/simulation';
import { newRequestId } from '../network/request-id';
import s from './reward-ui.module.css';

interface Props {
  state: BuildStateData;
  choice: BuildStateData['choices'][number];
  error: string;
  refresh: (data: RefreshGrowthData) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

export function GrowthRefresh(props: Props) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<RefreshGrowthData | null>(null);
  const count = props.choice.refreshCount ?? 0;
  const source = props.choice.source;
  const cost = source === 'wave' ? growthRefreshPrices.wave : growthRefreshPrices.level;
  const balance = props.state.coinsEarned - props.state.coinsSpent;
  useEffect(() => { pending.current = null; setBusy(false); setConfirming(false); setError(''); }, [props.choice.id, count]);
  useEffect(() => { if (props.error) { setBusy(false); setConfirming(false); } }, [props.error]);
  useEffect(() => { const awaiting = busy || confirming; props.onBusyChange?.(awaiting); }, [busy, confirming, props.onBusyChange]);
  useEffect(() => () => props.onBusyChange?.(false), [props.onBusyChange]);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => { setBusy(false); setConfirming(true); }, 10000);
    return () => window.clearTimeout(timer);
  }, [busy]);
  function refresh(): void {
    if (busy || props.disabled) return;
    setBusy(true); setConfirming(false); setError('');
    try {
      if (!pending.current) {
        const requestId = newRequestId();
        pending.current = { requestId, choiceId: props.choice.id, refreshCount: count };
      }
      props.refresh(pending.current);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '刷新失败，请重试';
      setError(message); setBusy(false);
    }
  }
  if (source === 'link') return null;
  return <div className={s.refreshControl}><button className={s.refresh} type="button" onClick={refresh} disabled={busy || props.disabled || balance < cost}>{busy ? '正在刷新…' : confirming ? '重试刷新' : `↻ 换一组 · ${cost} 金币`}</button>{confirming && <span role="status">刷新待确认，请重试确认结果</span>}{error && <span role="alert">{error}</span>}</div>;
}
