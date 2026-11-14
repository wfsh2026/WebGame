import { useEffect, useRef, useState } from 'react';
import { HudIcon } from '../hud/hud-icon';
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
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const panel = dialog.current;
    if ((paused || menuOpen) && panel && !panel.open) { panel.showModal(); resume.current?.focus(); }
    else if (!paused && !menuOpen && panel?.open) panel.close();
  }, [paused, menuOpen]);
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
  function openMenu(): void { if (solo) change(true); else setMenuOpen(true); }
  function closeMenu(): void { if (paused && connected) change(false); else setMenuOpen(false); }
  function restoreFocus(): void { const canvas = document.querySelector<HTMLCanvasElement>('canvas'); canvas?.focus({ preventScroll: true }); }
  return <>
    {!paused && <button className={s.launcher} onClick={openMenu} disabled={!connected} aria-haspopup="dialog"><HudIcon name="menu" size={32} />菜单</button>}
    <dialog ref={dialog} className={s.dialog} aria-labelledby="pause-title" onClose={restoreFocus} onCancel={event => { event.preventDefault(); closeMenu(); }}>
      <span className={s.eyebrow}>林地围猎 · {solo ? '单人战斗' : '多人联机'}</span>
      <h2 id="pause-title">{paused ? '战斗已暂停' : '战斗菜单'}</h2>
      <p>{paused ? '战场与计时已冻结，准备好后继续冒险。' : '联机战斗持续进行。'}</p>
      <p>WASD 移动 · Shift 冲刺 · Space 格挡</p>
      <button ref={resume} onClick={closeMenu} disabled={paused && !connected}>{paused ? '继续战斗' : '返回战斗'}</button>
      {paused && <small>{connected ? '按 ESC 也可继续' : '连接恢复后可继续战斗'}</small>}
    </dialog>
  </>;
}
