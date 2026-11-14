import { useEffect, useRef, useState } from 'react';
import type { RefreshGrowthData } from '../../../../packages/contracts/src/index';
import { CombatHud } from '../../../../apps/web/src/hud/combat-hud';
import { BuildPanel } from '../../../../apps/web/src/online/build-panel';
import { SurvivalOverlay } from '../../../../apps/web/src/online/survival-overlay';
import { PauseMenu } from '../../../../apps/web/src/online/pause-menu';
import { BattleRuntime } from '../../../../apps/web/src/game/battle-runtime';
import type { SceneBridge } from '../../../../apps/web/src/game/online-scene';
import { PickupNotices } from '../../../../apps/web/src/hud/pickup-notices';
import { PickupNoticeFeed } from '../../../../apps/web/src/hud/pickup-notice-feed';
import s from '../../../../apps/web/src/online/online.module.css';
import { battleFixture } from './fixture';

const query = new URLSearchParams(location.search); const scenario = query.get('case') ?? 'default';
export default function BattleReview() {
  const [fixture] = useState(() => battleFixture(scenario));
  const [snapshot, setSnapshot] = useState(fixture.snapshot); const [build, setBuild] = useState(fixture.build);
  const [feed] = useState(() => new PickupNoticeFeed());
  const [bridge] = useState<SceneBridge>(() => ({ current: fixture.snapshot, playerId: fixture.snapshot.players[0].id, pickups: [], lootTarget: () => undefined, lootLanded: () => {}, send: () => {} }));
  const [runtime] = useState(() => new BattleRuntime(bridge));
  const [loading, setLoading] = useState({ progress: 0, ready: false, error: '' }); const host = useRef<HTMLDivElement>(null);
  const player = snapshot.players[0]; const abilities = player.abilities ?? [];
  const living = snapshot.players.filter(entry => entry.hp > 0).length; const coins = Math.max(0, build.coinsEarned - build.coinsSpent);
  useEffect(() => {
    const unsubscribe = runtime.subscribe(setLoading); const container = host.current;
    if (container) runtime.attach(container);
    return () => { unsubscribe(); runtime.dispose(); feed.clear(); };
  }, [runtime, feed]);
  useEffect(() => { bridge.current = snapshot; }, [snapshot, bridge]);
  useEffect(() => {
    if (!loading.ready) return;
    let sequence = 0;
    const notice = () => { sequence += 1; const first = fixture.loot.safe[1]; const item = { ...first, id: `notice-${sequence}`, category: 'temporary' as const }; const event = { item, playerId: player.id }; feed.receive(event); };
    notice(); const timer = window.setInterval(notice, 2800); return () => window.clearInterval(timer);
  }, [loading.ready, feed, fixture, player.id]);
  function pause(paused: boolean): void { setSnapshot(current => ({ ...current, paused })); }
  function ready(prepared: boolean, solo: boolean): void { setSnapshot(current => solo ? { ...current, resting: false, preparation: undefined } : { ...current, preparation: current.preparation ? { ...current.preparation, readyIds: prepared ? [player.id] : [] } : undefined }); }
  function choose(id: number): void { setBuild(current => ({ ...current, choices: current.choices.filter(choice => choice.id !== id) })); }
  function refresh(data: RefreshGrowthData): void { setBuild(current => ({ ...current, choices: current.choices.map(choice => choice.id === data.choiceId ? { ...choice, refreshCount: choice.refreshCount + 1 } : choice) })); }
  const ignore = () => {};
  return <main className={s.battleShell} data-battle-review data-ready={loading.ready}>
    <div ref={host} className={s.arena} />
    <CombatHud player={player} players={snapshot.players} abilities={abilities} runtime={runtime} />
    <BuildPanel connected snapshot={snapshot} waveReady={ready} remind={ignore} resting={snapshot.resting ?? false} loot={fixture.loot} player={player} discard={ignore} state={build} error="" refresh={refresh} choose={choose} equip={ignore} />
    <SurvivalOverlay expedition={snapshot.expedition} coins={coins} enemies={snapshot.enemies.length} warnings={[]} pending={16} round={snapshot.round} seconds={snapshot.seconds} survived={436} resting={snapshot.resting ?? false} preparation={snapshot.preparation} living={living} total={snapshot.players.length} />
    <PauseMenu snapshot={snapshot} runtime={runtime} change={pause} connection="已连接权威房间" /><PickupNotices feed={feed} />
    {!loading.ready && <div className={s.loadingBattle} role="status">{loading.error || '正在加载实际战斗组件…'}</div>}
  </main>;
}
