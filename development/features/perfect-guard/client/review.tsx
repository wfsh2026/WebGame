import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { BattleRuntime } from '../../../../apps/web/src/game/battle-runtime';
import type { SceneBridge } from '../../../../apps/web/src/game/online-scene';
import { CombatHud } from '../../../../apps/web/src/hud/combat-hud';
import { GuardReviewScene, guardReviewSnapshot } from './review-scene';
import type { GuardReviewFrame, ReviewMode } from './review-scene';
import s from './review.module.css';

export default function GuardReview() {
  const [snapshot] = useState(guardReviewSnapshot);
  const [frame, setFrame] = useState<GuardReviewFrame>({ player: snapshot.players[0], phase: '正在加载', incoming: '等待命中', outgoing: '等待攻击', clock: 0, events: [] });
  const [mode, setMode] = useState<ReviewMode>('auto');
  const [loading, setLoading] = useState({ progress: 0, ready: false, error: '' });
  const scene = useRef<GuardReviewScene | undefined>(undefined); const host = useRef<HTMLDivElement>(null);
  const [bridge] = useState<SceneBridge>(() => ({ current: snapshot, playerId: snapshot.players[0].id, active: true, pickups: [], lootTarget: () => undefined, lootLanded: () => {}, send: () => {} }));
  const [runtime] = useState(() => {
    const factory = (current: SceneBridge) => { const created = new GuardReviewScene(current, setFrame); scene.current = created; return created; };
    return new BattleRuntime(bridge, factory);
  });
  useEffect(() => {
    const unsubscribe = runtime.subscribe(setLoading); const element = host.current;
    if (element) runtime.attach(element);
    return () => { unsubscribe(); runtime.dispose(); };
  }, [runtime]);
  useEffect(() => { bridge.current = { ...snapshot, players: [frame.player], battleClock: frame.clock }; }, [bridge, snapshot, frame]);
  function changeMode(next: ReviewMode): void { setMode(next); scene.current?.setMode(next); }
  function restart(): void { scene.current?.resetRun(); }
  function strike(): void { const options = { delay: .6 }; scene.current?.attack(options); }
  function poison(): void { const options = { delay: .6, poison: true }; scene.current?.attack(options); }
  function keepFocus(event: PointerEvent): void { event.preventDefault(); }
  const counter = Math.ceil(frame.player.guard?.counterLeft ?? 0);
  const clock = frame.clock.toFixed(1);
  return <main className={s.page} data-guard-review data-ready={loading.ready} data-phase={frame.phase} data-clock={clock} data-counter={counter}>
    <div ref={host} className={s.arena} />
    <CombatHud player={frame.player} players={[frame.player]} abilities={frame.player.abilities ?? []} runtime={runtime} />
    <aside className={s.panel} onPointerDown={keepFocus}>
      <b>格挡 · 精防 · 反击</b><p>全方位防御 · 精防窗口 0.25 秒</p>
      <div className={s.buttons}><button data-active={mode === 'auto'} onClick={() => changeMode('auto')}>自动演示</button><button data-active={mode === 'manual'} onClick={() => changeMode('manual')}>自由操作</button><button onClick={restart}>重新开始</button></div>
      <strong className={s.phase}>{frame.phase}</strong>
      <dl><div><dt>最近受击</dt><dd>{frame.incoming}</dd></div><div><dt>最近攻击</dt><dd>{frame.outgoing}</dd></div><div><dt>反击剩余</dt><dd>{counter} 秒</dd></div></dl>
      {mode === 'auto' ? <p>每16秒循环：普通格挡 → 精防成功 → 反击输出 → buff 到期。使用真实战斗逻辑及实际特效。</p> : <><p>点击战斗区域，用 WASD 移动、空格格挡。下方攻击在0.6秒后命中，临近命中时按下空格。</p><div className={s.buttons}><button onClick={strike}>背后攻击</button><button onClick={poison}>毒池伤害</button></div></>}
      <ol>{frame.events.map((event, index) => <li key={`${index}-${event}`}>{event}</li>)}</ol>
    </aside>
    {!loading.ready && <div className={s.loading}>{loading.error || '正在加载实际战斗效果…'}</div>}
  </main>;
}
