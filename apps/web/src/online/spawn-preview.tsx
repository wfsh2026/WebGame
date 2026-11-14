import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { SpawnPreviewScene } from './spawn-preview-scene';
import type { SpawnPreviewState } from './spawn-preview-scene';
import s from './spawn-preview.module.css';

export function SpawnPreview() {
  const host = useRef<HTMLDivElement>(null); const scene = useRef<SpawnPreviewScene | null>(null);
  const [state, setState] = useState<SpawnPreviewState | null>(null);
  const gameHref = import.meta.env.DEV ? 'online.html' : import.meta.env.BASE_URL;
  useEffect(() => {
    if (!host.current) return;
    const preview = new SpawnPreviewScene(setState); scene.current = preview;
    const config: Phaser.Types.Core.GameConfig = { type: Phaser.AUTO, parent: host.current, width: host.current.clientWidth, height: host.current.clientHeight, backgroundColor: '#142c26', scale: { mode: Phaser.Scale.RESIZE }, scene: [preview], render: { antialias: true }, fps: { target: 60, limit: 60 } };
    const game = new Phaser.Game(config);
    return () => { scene.current = null; game.destroy(true); };
  }, []);
  return <main className={s.page}>
    <header><div><h1>刷怪位置与连续刷新</h1><p>先避开玩家选点，预警开始后固定位置。</p></div><a href={gameHref}>返回游戏</a></header>
    <section className={s.controls} aria-label="刷怪效果控制">
      <button disabled={!state} onClick={() => scene.current?.resetDemo()}>重置并暂停</button>
      <button disabled={!state || state.elapsed >= 60} onClick={() => scene.current?.approachWarning()}>移到首个预警点</button>
      <button disabled={!state || state.elapsed >= 60} aria-pressed={state?.running ?? false} onClick={() => scene.current?.toggleRunning()}>{state?.running ? '暂停' : '开始 / 继续'}</button>
    </section>
    <div className={s.canvas} ref={host} />
    <section className={s.status} aria-live="polite" data-spawned={state?.spawned} data-living={state?.living} data-pending={state?.pending} data-drift={state?.drift}>
      <span>波次时间 {state?.elapsed.toFixed(1) ?? '0.0'} / 60 秒</span><span>已入队 {state?.issued ?? 0}</span><span>已出生 {state?.spawned ?? 0}</span><span>存活 {state?.living ?? 0}</span><span>待出生 {state?.pending ?? 0}</span>
      <span>首个锁定坐标 {state?.lock ?? '等待选点'}</span><span>选点时距离玩家 {state?.initialDistance.toFixed(2) ?? '—'}</span><span>坐标偏移 {state?.drift.toFixed(4) ?? '0.0000'}</span><span>{state?.status ?? '正在加载'} · {state?.countdown.toFixed(2) ?? '0.00'} 秒</span>
    </section>
    <p>点击“移到首个预警点”，再继续运行，观察原位置按时出怪，坐标偏移保持 0。金色小框标出首次锁定的位置。</p>
    <p>每 3 秒安排 24 只怪物，共 60 秒。保留已有怪物，观察密集状态下继续刷新。点击战场后可用 WASD 移动。</p>
    <p>此页面复用对局的刷怪、移动和预警实现；角色提高生命且关闭自动攻击，便于观察怪物累积，不写入账号资产。</p>
  </main>;
}
