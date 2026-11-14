import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import type { ChangeEvent } from 'react';
import type { LootPickupData } from '@web-game-world/contracts';
import { LootPreviewScene } from './loot-preview-scene';
import type { PreviewState } from './loot-preview-scene';
import { ExperienceBar } from '../hud/experience-bar';
import { PickupNotices } from '../hud/pickup-notices';
import { PickupNoticeFeed } from '../hud/pickup-notice-feed';
import s from './loot-preview.module.css';

export function LootPreview() {
  const host = useRef<HTMLDivElement>(null); const scene = useRef<LootPreviewScene | null>(null);
  const [state, setState] = useState<PreviewState | null>(null); const [moving, setMoving] = useState(false);
  const [kind, setKind] = useState('melee');
  const [pickupFeed] = useState(() => new PickupNoticeFeed());
  const [noticeKind, setNoticeKind] = useState('skill'); const [noticeLevel, setNoticeLevel] = useState(15);
  const gameHref = import.meta.env.DEV ? 'online.html' : import.meta.env.BASE_URL;
  useEffect(() => {
    if (!host.current) return;
    const picked = (event: LootPickupData): void => { pickupFeed.receive(event); };
    const preview = new LootPreviewScene(setState, picked); scene.current = preview;
    const config: Phaser.Types.Core.GameConfig = { type: Phaser.AUTO, parent: host.current, width: host.current.clientWidth, height: host.current.clientHeight, backgroundColor: '#142c26', scale: { mode: Phaser.Scale.RESIZE }, scene: [preview], render: { antialias: true }, fps: { target: 60, limit: 60 } };
    const game = new Phaser.Game(config);
    return () => { scene.current = null; game.destroy(true); pickupFeed.clear(); };
  }, [pickupFeed]);
  function reset(): void { pickupFeed.clear(); scene.current?.resetDemo(); setMoving(false); }
  function move(): void { scene.current?.toggleMovement(); setMoving(previous => !previous); }
  function changeLevel(event: ChangeEvent<HTMLSelectElement>): void { const level = Number(event.target.value); scene.current?.setLevel(level); }
  function changeKind(event: ChangeEvent<HTMLSelectElement>): void { const kind = event.target.value; setKind(kind); setMoving(false); pickupFeed.clear(); scene.current?.setLootKind(kind); }
  function changeNoticeKind(event: ChangeEvent<HTMLSelectElement>): void { setNoticeKind(event.target.value); }
  function changeNoticeLevel(event: ChangeEvent<HTMLSelectElement>): void { const level = Number(event.target.value); setNoticeLevel(level); }
  function notice(): void { scene.current?.previewNotice(noticeKind, noticeLevel); }
  function noticeCombo(): void { pickupFeed.clear(); scene.current?.previewNotice('skill', 15); scene.current?.previewNotice('life'); scene.current?.previewNotice('haste'); }
  return <main className={s.page}>
    <header><div><h1>掉落与成长效果</h1><p>白 · 绿 · 蓝 · 紫 · 金，同一种物品保持相同图形。</p></div><a href={gameHref}>返回游戏</a></header>
    <section className={s.controls} aria-label="效果控制">
      <button disabled={!state} onClick={reset}>重置五色掉落</button><button disabled={!state} onClick={() => scene.current?.defeat()}>击杀怪物</button><button disabled={!state} onClick={() => scene.current?.collectAll()}>吸取全部</button><button disabled={!state} aria-pressed={moving} onClick={move}>{moving ? '停止自动移动' : '自动移动拾取者'}</button><button disabled={!state} onClick={() => scene.current?.upgrade()}>升一级</button>
      <label>角色等级<select disabled={!state} aria-label="角色等级" value={state?.level ?? 9} onChange={changeLevel}>{[1, 9, 10, 19, 20, 39, 40, 59, 60, 79, 80, 99, 100].map(level => <option key={level} value={level}>Lv.{level}</option>)}</select></label>
      <button disabled={!state} onClick={() => scene.current?.collectBurst()}>密集拾取（100件）</button>
      <label>物品类型<select disabled={!state} aria-label="物品类型" value={kind} onChange={changeKind}><option value="melee">近战技能</option><option value="ranged">远程技能</option><option value="heart">心法</option><option value="support">辅助宝石</option><option value="life">生命补给</option><option value="energy">灵力补给</option></select></label>
    </section>
    <section className={s.controls} aria-label="获得提示控制">
      <button disabled={!state} onClick={noticeCombo}>获得提示组合</button>
      <label>获得类型<select disabled={!state} aria-label="获得类型" value={noticeKind} onChange={changeNoticeKind}><option value="skill">技能</option><option value="heart">心法</option><option value="support">辅助宝石</option><option value="haste">急速</option><option value="focus">聚灵</option><option value="shield">护盾</option><option value="life">生命恢复</option><option value="energy">灵力恢复</option><option value="mana">灵力露滴</option><option value="fullLife">生命已满</option><option value="fullEnergy">灵力已满</option></select></label>
      <label>物品等级<select disabled={!state} aria-label="物品等级" value={noticeLevel} onChange={changeNoticeLevel}>{[3, 8, 12, 15, 20].map(level => <option key={level} value={level}>Lv.{level}</option>)}</select></label>
      <button disabled={!state} onClick={notice}>触发获得提示</button>
    </section>
    <div className={s.canvas}><div className={s.scene} ref={host} /><PickupNotices feed={pickupFeed} /></div>
    <section className={s.status} aria-live="polite" data-level={state?.level} data-experience={state?.experience} data-ground-experience={state?.groundExperience} data-flights={state?.flights} data-landed={state?.landed} data-distance={state?.distance}>
      <div className={s.experience}><ExperienceBar level={state?.level ?? 9} experience={state?.experience ?? 0} /></div><span>地面经验 {state?.groundExperience ?? 0}</span><span>飞行中 {state?.flights ?? 0}</span><span>已吸收物品 {state?.landed ?? 0}</span>
    </section>
    <p className={s.hint}>点击战场后使用 WASD 移动，按住 Shift 加速。击杀即时获得 4 点经验，地面留下 4 点；靠近或点击“吸取全部”查看飞行。选择 9、19 等级再升级可查看换框。</p>
    <p className={s.hint}>此界面复用对局的物品、拾取和升级渲染，不写入账号资产。</p>
    <p className={s.hint}>获得提示复用对局的实际组件，最多显示三条；连续相同收益合并计数，其他提示排队显示。恢复与护盾数值为此页面的展示样例。</p>
  </main>;
}
