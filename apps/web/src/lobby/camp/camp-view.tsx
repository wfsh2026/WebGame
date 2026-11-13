import type { BackpackViewProps } from '../../online/lobby-view';
import { Shop } from './shop';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { calculateCharacterStats, characterTalents } from '@web-game-world/simulation';
import type { LobbyViewProps } from '../../online/lobby-view';
import { CampScene } from './camp-scene';
import { campShopPlacement } from './camp-assets';
import type { CampBridge } from './camp-scene';
import manifest from '../../network/content';
import s from './camp.module.css';
import { appVersion } from '../../app-version';
import { SkillConstellation } from './skill-constellation';
import { loadPartyBoard } from '../party/party-assets';

const testToolsEnabled = import.meta.env.BASE_URL === '/online-test/' || import.meta.env.VITE_TEST_TOOLS === 'true';
const TestTools = testToolsEnabled ? lazy(() => import('./test-tools')) : null;

type Panel = 'test-tools' | 'shop' | 'character' | 'skills' | 'expeditions' | 'history' | 'settings' | null;
interface CampProps extends LobbyViewProps { preview?: boolean }
const facilities: { id: Exclude<Panel, null | 'settings' | 'test-tools'>; label: string; area: string }[] = [
  { id: 'character', label: '角色', area: s.character },
  { id: 'skills', label: '技能搭配', area: s.skills },
  { id: 'expeditions', label: '秘境', area: s.expeditions },
  { id: 'history', label: '冒险记录', area: s.history },
  { id: 'shop', label: '商店', area: s.shop }
];
const titles = { 'test-tools': '测试工具', shop: '商店', character: '角色', skills: '技能搭配', expeditions: '秘境', history: '冒险记录', settings: '设置' };
const statLabels = { maxHp: '最大生命', maxMp: '最大魔法', physicalAttack: '物理攻击', magicalAttack: '魔法攻击', physicalDefense: '物理防御', magicalDefense: '魔法防御', movementSpeed: '移动速度', attackSpeed: '攻击倍率', castingSpeed: '施法倍率', luck: '幸运' };

export function CampView(props: CampProps) {
  const { profile, rooms, history, busy, error, enterRoom, logout, preview } = props;
  const [backpackOpen, setBackpackOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [equipmentBusy, setEquipmentBusy] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [notice, setNotice] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const character = profile.character;
  const build = character ?? { points: { ...manifest.character.points }, talents: [] };
  const stats = calculateCharacterStats(build);
  const name = character?.name ?? profile.name;
  const bridge = useRef<CampBridge>({ blocked: false, name, speed: stats.movementSpeed, reducedMotion, onReady: () => setReady(true), onProgress: setLoadProgress, onLoadError: () => setLoadFailed(true) });
  bridge.current.blocked = panel !== null || backpackOpen;
  bridge.current.name = name;
  bridge.current.speed = stats.movementSpeed;
  bridge.current.reducedMotion = reducedMotion;

  useEffect(() => {
    if (!ready) return;
    const loading = loadPartyBoard();
    void loading.catch(() => { /* 预载失败时，进入队伍会再次尝试；不影响营地使用。 */ });
  }, [ready]);

  useEffect(() => {
    if (!host.current) return;
    const scene = new CampScene(bridge.current);
    const config: Phaser.Types.Core.GameConfig = { type: Phaser.AUTO, parent: host.current, width: 1672, height: 941, backgroundColor: '#24382a', scene: [scene], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true }, fps: { target: 60 } };
    const game = new Phaser.Game(config);
    return () => { game.destroy(true); };
  }, []);

  useEffect(() => {
    const current = dialog.current;
    if (!current) return;
    if (panel) current.showModal();
    else { current.close(); lastTrigger.current?.focus(); }
  }, [panel]);

  function openPanel(id: Exclude<Panel, null>): void { lastTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setNotice(''); setPanel(id); }
  function closePanel(): void { if (!busy && !equipmentBusy) setPanel(null); }
  async function joinRoom(id?: string): Promise<void> {
    if (preview) { setNotice('当前为场景预览，请进入本地账号模式后创建或加入房间。'); return; }
    await enterRoom(id);
  }
  function joinByCode(): void { const id = roomCode.trim(); if (id) void joinRoom(id); }
  function createRoom(): void { void joinRoom(); }
  const talentItems = characterTalents.filter(talent => build.talents.includes(talent.id));
  const statItems = Object.entries(stats).map(([key, value]) => {
    const label = Object.entries(statLabels).find(([id]) => id === key)?.[1] ?? key;
    const fixed = value.toFixed(2);
    const formatted = Number(fixed);
    return <div key={key}><dt>{label}</dt><dd>{formatted}</dd></div>;
  });
  const hasRooms = rooms.length > 0;
  const shopLeft = campShopPlacement.x - campShopPlacement.size / 2;
  const shopTop = campShopPlacement.y - campShopPlacement.size * (campShopPlacement.originY - campShopPlacement.topPadding);
  const shopHeight = campShopPlacement.size * (campShopPlacement.originY - campShopPlacement.topPadding);
  const shopStyle = { left: `${shopLeft / 1672 * 100}%`, top: `${shopTop / 941 * 100}%`, width: `${campShopPlacement.size / 1672 * 100}%`, height: `${shopHeight / 941 * 100}%` };
  const backpackProps: BackpackViewProps | null = props.loadInventory ? { mode: 'lobby', loadInventory: props.loadInventory, disabled: panel !== null, onOpenChange: setBackpackOpen } : null;
  const backpack = backpackProps ? props.renderBackpack?.(backpackProps) : null;
  return <main className={s.root}>
    <div className={s.stage}>
      <div ref={host} className={s.canvas} />
      {(!ready || loadFailed) && <div className={s.loading} role="status"><section><h2>{loadFailed ? '营地资源加载失败' : '正在加载大厅场景'}</h2><progress max={1} value={loadProgress} aria-label="大厅资源加载进度" style={{ width: '100%' }} /><p>{loadFailed ? '请刷新页面重新进入。' : loadProgress < 1 ? `已完成 ${Math.round(loadProgress * 100)}% 的资源文件` : '资源已下载，正在准备场景…'}</p><small>进度按资源文件计算</small></section></div>}
      <header className={s.topbar}>
        <button className={s.identity} onClick={() => openPanel('character')} aria-label="查看角色资料"><span className={s.portrait} /><span><b>{name}</b><small>♧ 林间营地</small></span></button>
        <div className={s.wallet}><span><i className={s.coin}>金</i> {profile.coins}</span><span><i className={s.material}>◆</i> {profile.materials}</span></div>
        {backpack}
        {TestTools && props.loadTestAssets && <button className={s.testTools} onClick={() => openPanel('test-tools')} disabled={busy || equipmentBusy}>测试工具</button>}
        <button className={s.settings} onClick={() => openPanel('settings')} aria-label="设置">⚙</button>
      </header>
      {facilities.map(facility => <button key={facility.id} className={`${s.facility} ${facility.area}`} style={facility.id === 'shop' ? shopStyle : undefined} aria-label={`打开${facility.label}`} onClick={() => openPanel(facility.id)}><span>◇　{facility.label}　◇</span><i aria-hidden="true" /></button>)}
      <div className={s.hint}>◇　 WASD 移动 · 点击场景设施打开界面　 ◇</div>
      <span className={s.version}>v{appVersion}</span>
      {error && !panel && <div className={s.error} role="alert">{error}</div>}
      {preview && <a className={s.preview} href="?mode=online">场景预览 · 进入本地账号模式 ↗</a>}
    </div>
    <dialog ref={dialog} className={`${s.dialog} ${panel === 'skills' ? s.skillDialog : ''}`} aria-labelledby="camp-panel-title" onCancel={event => { event.preventDefault(); closePanel(); }} onClick={event => { if (event.target === event.currentTarget) closePanel(); }}>
      <section className={`${s.panel} ${panel === 'skills' ? s.skillPanel : ''}`}>
        <header className={s.panelHeader}><div><small>林 间 营 地</small><h1 id="camp-panel-title">{panel ? titles[panel] : ''}</h1></div><button aria-label="关闭界面" disabled={busy || equipmentBusy} onClick={closePanel}>×</button></header>
        <div className={`${s.panelBody} ${panel === 'skills' ? s.skillBody : ''}`}>
          {error && <p className={s.message} role="alert">{error}</p>}{notice && <p className={s.message} role="status">{notice}</p>}
          {panel === 'character' && <><div className={s.characterIntro}><span className={s.portrait} /><div><h2>{name}</h2><p>{character?.description || '营地的旅人，正准备迎接下一次冒险。'}</p></div></div><h3>角色属性</h3><dl className={s.stats}>{statItems}</dl><h3>已选天赋</h3><div className={s.tags}>{talentItems.length ? talentItems.map(talent => <span key={talent.id}>{talent.name}</span>) : <span>尚无天赋记录</span>}</div><p className={s.subtle}>展示账号已保存的角色配置，初始点数与天赋在创建角色时确定。</p></>}
          {panel === 'test-tools' && TestTools && <Suspense fallback={<p>正在加载测试工具…</p>}><TestTools addInventory={props.addTestInventory} loadAssets={props.loadTestAssets} adjustAssets={props.adjustTestAssets} onBusyChange={setEquipmentBusy} /></Suspense>}
          {panel === 'shop' && <Shop loadShop={preview ? undefined : props.loadShop} purchaseProduct={preview ? undefined : props.purchaseProduct} refreshShop={preview ? undefined : props.refreshShop} onBusyChange={setEquipmentBusy} />}
          {panel === 'skills' && <SkillConstellation attackSpeed={stats.attackSpeed} castingSpeed={stats.castingSpeed} maxMp={stats.maxMp} loadEquipment={preview ? undefined : props.loadEquipment} saveEquipment={preview ? undefined : props.saveEquipment} onBusyChange={setEquipmentBusy} />}
          {panel === 'expeditions' && <><div className={s.riftCard}><small>森语遗迹 · 完整秘境</small><h2>{manifest.name}</h2><p>持续抵抗怪潮，争取击杀、助攻和生存收益。</p><div className={s.tags}><span>{manifest.players.min}–{manifest.players.max} 人协作</span><span>持续波次</span><span>灵魂移动与复活</span></div><p className={s.subtle}>清空本波后休息，全员准备后进入下一波。全员灵魂后失败并结算。</p><button className={s.primary} onClick={createRoom} disabled={busy}>{busy ? '正在连接…' : '创建房间'}</button></div><h3>加入同行者</h3><form className={s.join} onSubmit={event => { event.preventDefault(); joinByCode(); }}><input aria-label="房间编号" placeholder="输入好友的房间编号" value={roomCode} maxLength={50} onChange={event => setRoomCode(event.target.value)} /><button disabled={busy || !roomCode.trim()}>加入</button></form><h3>等待中的房间</h3>{hasRooms ? rooms.map(room => <div className={s.row} key={room.roomId}><div><b>{room.name}</b><small>{room.roomId} · {room.clients}/{room.maxClients} 人</small></div><button disabled={busy} onClick={() => { void joinRoom(room.roomId); }}>加入</button></div>) : <p className={s.empty}>篝火旁暂时没有等待中的队伍，创建房间邀请好友吧。</p>}</>}
          {panel === 'history' && <>{history.length ? history.map(record => { const date = new Date(record.run.createdAt); const dateText = date.toLocaleString('zh-CN'); const status = record.run.status === 'completed' ? '已完成' : record.run.status === 'failed' ? '挑战结束' : '进行中 / 中断'; return <div className={s.row} key={record.runId}><div><b>{status}</b><small>{dateText}</small></div><span>{record.settled ? `金币 +${record.coins} · 素材 +${record.materials}` : '尚未结算'}</span></div>; }) : <div className={s.empty}><h2>旅程即将开始</h2><p>完成第一次秘境后，在这里回顾你的冒险与收获。</p></div>}</>}
          {panel === 'settings' && <><label className={s.option}><span>减少环境动态<small>减弱营地装饰光效</small></span><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} /></label><p className={s.subtle}>WASD 移动 · 点击设施打开系统 · Esc 关闭界面。打开界面或窗口失焦时，角色停止移动。</p>{preview ? <a className={s.link} href="?mode=online">进入本地账号模式 →</a> : <button onClick={() => { void logout(); }} disabled={busy}>退出账号</button>}</>}
        </div><footer className={s.panelFooter}>营火常明，静候归人。<span>Esc 关闭</span></footer>
      </section>
    </dialog>
  </main>;
}


