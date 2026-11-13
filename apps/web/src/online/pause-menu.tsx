import { useEffect, useRef } from 'react';
import type { Snapshot } from '@web-game-world/contracts';
import type { BattleRuntime } from '../game/battle-runtime';
import s from './pause-menu.module.css';

interface PauseMenuProps { snapshot: Snapshot; runtime: BattleRuntime; change: (paused: boolean) => void; connection: string }
export function PauseMenu({ snapshot, runtime, change, connection }: PauseMenuProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const resume = useRef<HTMLButtonElement>(null);
  const paused = Boolean(snapshot.paused);
  const solo = snapshot.players.length === 1;
  const connected = connection === '已连接权威房间';
  useEffect(() => {
    const panel = dialog.current;
    if (paused && panel && !panel.open) { panel.showModal(); resume.current?.focus(); }
    else if (!paused && panel?.open) panel.close();
  }, [paused]);
  useEffect(() => {
    const unsubscribe = runtime.subscribe(state => { if (state.ready) runtime.setPaused(paused); });
    return unsubscribe;
  }, [runtime, paused]);
  useEffect(() => {
    function keyDown(event: KeyboardEvent): void {
      if (paused) event.stopImmediatePropagation();
      if (event.code !== 'Escape' || event.repeat || !solo) return;
      const openDialog = document.querySelector('dialog[open]');
      if (!paused && openDialog) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (connected) change(!paused);
    }
    window.addEventListener('keydown', keyDown, true);
    return () => window.removeEventListener('keydown', keyDown, true);
  }, [paused, solo, connected, change]);
  return <>
    {solo && !paused && <button className={s.launcher} onClick={() => change(true)} disabled={!connected}>暂停 · ESC</button>}
    <dialog ref={dialog} className={s.dialog} aria-labelledby="pause-title" onCancel={event => { event.preventDefault(); if (connected) change(false); }}>
      <span className={s.eyebrow}>林地围猎 · 单人战斗</span>
      <h2 id="pause-title">战斗已暂停</h2>
      <p>战场与计时已冻结，准备好后继续冒险。</p>
      <button ref={resume} onClick={() => change(false)} disabled={!connected}>继续战斗</button>
      <small>{connected ? '按 ESC 也可继续' : '连接恢复后可继续战斗'}</small>
    </dialog>
  </>;
}
