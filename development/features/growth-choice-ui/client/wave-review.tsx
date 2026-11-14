import { useEffect, useRef, useState } from 'react';
import type { EquipmentLoadoutData, ExpeditionActionData, RefreshGrowthData } from '@web-game-world/contracts';
import { awardHellGrowth, beginRound, changeBuild, chooseGrowth, discardBuildItem, growthRefreshPrices, refreshedGrowthOptions } from '@web-game-world/simulation';
import content from '../../../../apps/web/src/network/content';
import { BuildPanel } from '../../../../apps/web/src/online/build-panel';
import { ExpeditionResult } from '../../../../apps/web/src/online/expedition-result';
import { buildView, createPreview, snapshotView } from './preview-state';
import s from './design.module.css';

const query = new URLSearchParams(location.search);
const scenario = query.get('case') ?? 'normal';

export function WaveReview() {
  const [model] = useState(() => createPreview(scenario));
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const refreshReceipts = useRef<Record<string, boolean>>({});
  const rejectedOnce = useRef(false);
  const player = model.sim.players[0];
  const state = buildView(player);
  const snapshot = snapshotView(model);
  const gifts = Math.max(model.gifts, player.choices.filter(choice => choice.hellEntry).length);
  const pending = player.choices.filter(choice => !choice.hellEntry).length + gifts;
  const ready = model.readyIds.includes(player.id);
  const balance = state.coinsEarned - state.coinsSpent;
  function changed(): void { setRevision(previous => previous + 1); }
  function cancelReady(): void { model.readyIds = model.readyIds.filter(id => id !== player.id); model.countdown = 0; }
  async function request(action: () => string): Promise<void> {
    if (!model.connected) return;
    setError('');
    const latency = scenario === 'slow' ? 1200 : 240;
    const delay = new Promise<void>(resolve => { window.setTimeout(resolve, latency); });
    await delay;
    const result = action();
    if (result) setError(result); else cancelReady();
    changed();
  }
  function choose(id: number, index: number, targetId?: string): void {
    const choice = player.choices.find(choice => choice.id === id);
    const data = { choiceId: id, index, targetId };
    const action = (): string => {
      if (scenario === 'retry' && !rejectedOnce.current) { rejectedOnce.current = true; return '领取尚未保存，请重试'; }
      const result = chooseGrowth(model.sim, player, data);
      if (result) return result;
      if (choice?.hellEntry) { model.gifts -= 1; if (model.gifts > 0) awardHellGrowth(model.sim, player); }
      return '';
    };
    void request(action);
  }
  function refresh(data: RefreshGrowthData): void {
    const action = (): string => {
      if (refreshReceipts.current[data.requestId]) return '';
      const choice = player.choices.find(choice => choice.id === data.choiceId);
      if (!choice || choice.source === 'link' || data.refreshCount !== (choice.refreshCount ?? 0)) return '候选项已变化，请重试';
      const cost = choice.source === 'wave' ? growthRefreshPrices.wave : growthRefreshPrices.level;
      if ((player.coinsEarned ?? 0) - (player.coinsSpent ?? 0) < cost) return '本局金币不足';
      const options = refreshedGrowthOptions(model.sim, player, choice);
      choice.options = options; choice.refreshCount = (choice.refreshCount ?? 0) + 1;
      player.coinsSpent = (player.coinsSpent ?? 0) + cost; player.buildRevision += 1;
      refreshReceipts.current[data.requestId] = true;
      return '';
    };
    void request(action);
  }
  function equip(loadout: EquipmentLoadoutData, revision: number): void { const data = { loadout, revision }; const action = (): string => changeBuild(player, data, content); void request(action); }
  function discard(id: string): void { const action = (): string => discardBuildItem(player, id); void request(action); }
  function readyNext(ready: boolean, solo: boolean): void {
    if (model.saving || !model.connected || model.gifts > 0 || model.sim.round >= 20 && !model.continued) return;
    if (solo) { const round = model.sim.round + 1; beginRound(model.sim, round); model.phase = 'combat'; }
    else if (ready) model.readyIds.push(player.id);
    else { model.readyIds = model.readyIds.filter(id => id !== player.id); model.countdown = 0; }
    changed();
  }
  function remind(): void { model.reminded = true; changed(); }
  function decide(data: ExpeditionActionData): void {
    if (model.saving || !model.connected) return;
    const action = (): string => {
      if (data.action === 'extract') model.phase = 'result';
      else { model.continued = true; if (model.sim.round === 20) { model.gifts = 5; awardHellGrowth(model.sim, player); } }
      return '';
    };
    void request(action);
  }
  async function closeResult(): Promise<void> { model.phase = 'lobby'; changed(); }
  useEffect(() => {
    const complete = !model.solo && model.phase === 'rest' && !model.saving && model.connected && (model.sim.round < 20 || model.continued) && model.gifts === 0 && model.sim.players.every(player => player.connected && model.readyIds.includes(player.id));
    if (!complete) return;
    model.countdown = 3; changed();
    const timer = window.setInterval(() => {
      model.countdown -= 1;
      if (model.countdown <= 0) { const round = model.sim.round + 1; beginRound(model.sim, round); model.phase = 'combat'; window.clearInterval(timer); }
      changed();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [model.readyIds.join(','), model.saving, model.connected, model.gifts, model.continued, model.phase]);
  const controls = <details className={s.previewControls} data-preview-controls><summary>本地功能预览 · 场景切换</summary><nav>{[['normal', '普通波次'], ['done', '无待选奖励'], ['solo', '单人'], ['saving', '保存中'], ['reconnect', '断线'], ['poor', '金币不足'], ['decision', '20关通关'], ['hell', '入场5次'], ['hell-layer', '地狱层间']].map(([key, label]) => <a key={key} href={`?view=wave-rewards&case=${key}`}>{label}</a>)}</nav><button onClick={() => { const companions = model.sim.players.filter(item => item.id !== player.id).map(item => item.id); const ready = new Set([...model.readyIds, ...companions]); model.readyIds = [...ready]; changed(); }}>模拟队友全部准备</button><button onClick={() => { model.saving = false; model.connected = true; changed(); }}>模拟保存完成 / 连接恢复</button></details>;
  if (model.phase === 'result') {
    const reward = { id: player.id, coins: balance, materials: 0, outcome: 'extracted' as const, earned: state.coinsEarned, spent: state.coinsSpent, baseCleared: true, hellFloor: Math.max(0, model.sim.round - 20) };
    return <><ExpeditionResult expedition={snapshot.expedition} playerId={player.id} name={player.name} results={snapshot.results} reward={reward} busy={false} error={error} onClose={closeResult} />{controls}</>;
  }
  if (model.phase === 'lobby') return <main className={s.stage}><section className={s.returned}><h2>已返回游戏大厅 · 功能预览</h2><a href="?view=wave-rewards&case=normal">重新查看完整波次收获</a></section>{controls}</main>;
  return <main className={s.stage} data-revision={revision} data-phase={model.phase} data-pending={pending} data-gifts={gifts} data-ready={ready} data-balance={balance} data-countdown={model.countdown}>
    {model.phase === 'combat' && <p className={s.combatState}>第 {model.sim.round} 波已开始 · 实际界面组件预览</p>}
    <BuildPanel connected={model.connected} state={state} snapshot={snapshot} player={player} resting={model.phase === 'rest'} loot={model.loot} error={error} refresh={refresh} choose={choose} equip={equip} discard={discard} waveReady={readyNext} remind={remind} decide={decide} />{controls}
  </main>;
}

export default WaveReview;
