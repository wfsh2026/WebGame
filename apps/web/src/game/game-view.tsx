import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import { collectionTarget } from '../app/demo-data';
import s from '../app/app.module.css';

export function GameView({ theme, partySize, onComplete }: { theme: string; partySize: number; onComplete: () => void }) {
  const parent = useRef<HTMLDivElement>(null);
  const complete = useRef(onComplete);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { complete.current = onComplete; }, [onComplete]);
  useEffect(() => {
    let disposed = false;
    let game: Phaser.Game | undefined;
    setReady(false);
    setError(false);
    setProgress(0);
    async function start() {
      try {
        const module = await import('./demo-scene');
        if (disposed || !parent.current) return;
        const options = { theme, partySize, onProgress: setProgress, onComplete: () => { if (!disposed) complete.current(); } };
        game = module.createDemoGame(parent.current, options);
        setReady(true);
      } catch {
        if (!disposed) setError(true);
      }
    }
    void start();
    return () => { disposed = true; game?.destroy(true); };
  }, [theme, partySize, attempt]);

  function retry() { setAttempt(attempt + 1); }

  return <section className={s.gameFrame}>
    <div className={s.gameToolbar}><span><i className={s.statusDot} />收集散落星屑</span><strong>{progress} / {collectionTarget}</strong></div>
    <div className={s.gameCanvas} ref={parent} tabIndex={0} role="application" aria-label="星屑收集演示，点击地图移动，或聚焦后使用方向键和 WASD" onKeyDown={(event) => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault(); }} />
    {!ready && !error && <div className={s.gameMessage}>正在打开秘境…</div>}
    {error && <div className={s.gameMessage}><p>秘境画面加载失败，请重试。</p><button className={s.button} onClick={retry}>重新加载</button></div>}
    <div className={s.gameControls}><span>点击 / 轻触地图移动，靠近星屑即可收集</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 或方向键</span></div>
  </section>;
}
