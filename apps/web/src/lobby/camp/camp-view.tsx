import { expeditionDifficulties } from '@web-game-world/simulation';
import type { ExpeditionDifficultyData } from '@web-game-world/contracts';
import { CharacterUpgrade } from './character-upgrade';
import type { BackpackViewProps } from '../../online/lobby-view';
import { Shop } from './shop';
import { Expeditions } from './expeditions';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { calculateCharacterStats } from '@web-game-world/simulation';
import type { LobbyViewProps } from '../../online/lobby-view';
import { CampScene } from './camp-scene';
import { campShopPlacement } from './camp-assets';
import type { CampBridge } from './camp-scene';
import manifest from '../../network/content';
import s from './camp.module.css';
import { appVersion } from '../../app-version';
import { SkillConstellation } from './skill-constellation';
import { loadPartyBoard } from '../party/party-assets';
import { useTutorial } from '../../online/tutorial/tutorial-context';
import { TutorialCard, TutorialSettings } from '../../online/tutorial/tutorial-ui';
import g from '../../online/tutorial/tutorial.module.css';

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
const titles = { 'test-tools': '测试工具', shop: '商店', character: '角色成长', skills: '技能搭配', expeditions: '秘境', history: '冒险记录', settings: '设置' };

export function CampView(props: CampProps) {
  const { profile, rooms, history, busy, error, enterRoom, logout, preview } = props;
  const guide = useTutorial();
  const [backpackOpen, setBackpackOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [equipmentBusy, setEquipmentBusy] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const character = profile.character;
  const build = character ?? { points: { ...manifest.character.points }, talents: [] };
  const stats = calculateCharacterStats(build, profile.characterGrowth);
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
  function closePanel(): void {
    if (busy || equipmentBusy) return;
    if (panel === 'shop') guide.mark('shop-reviewed');
    setPanel(null);
  }
  function openExpeditions(): void { if (!busy && !equipmentBusy) setPanel('expeditions'); }
  async function joinRoom(id?: string, difficulty?: ExpeditionDifficultyData): Promise<void> {
    if (preview) { setNotice('当前为场景预览，请进入本地账号模式后创建或加入房间。'); return; }
    await enterRoom(id, difficulty);
  }
  const shopLeft = campShopPlacement.x - campShopPlacement.size / 2;
  const shopTop = campShopPlacement.y - campShopPlacement.size * (campShopPlacement.originY - campShopPlacement.topPadding);
  const shopHeight = campShopPlacement.size * (campShopPlacement.originY - campShopPlacement.topPadding);
  const shopStyle = { left: `${shopLeft / 1672 * 100}%`, top: `${shopTop / 941 * 100}%`, width: `${campShopPlacement.size / 1672 * 100}%`, height: `${shopHeight / 941 * 100}%` };
  const backpackProps: BackpackViewProps | null = props.loadInventory ? { mode: 'lobby', loadInventory: props.loadInventory, disabled: panel !== null, onOpenChange: setBackpackOpen } : null;
  const backpack = backpackProps ? props.renderBackpack?.(backpackProps) : null;
  const guidePanel = guide.phase === 'shop' ? 'shop' : guide.phase === 'build' ? 'skills' : guide.phase === 'growth' ? 'character' : 'expeditions';
  const guideTitle = guide.phase === 'shop' ? '前往商店' : guide.phase === 'build' ? '连接你的构筑' : guide.phase === 'growth' ? '提升角色成长' : guide.phase === 'battle' ? '继续完善局内构筑' : '进入第一次秘境';
  const guideText = guide.phase === 'shop' ? '认识心法、技能与辅助宝石，准备你的第一套构筑。' : guide.phase === 'build' ? '在技能搭配中连接心法、技能和兼容宝石。' : guide.phase === 'growth' ? '使用金币升级，再分配成长点并保存。' : guide.phase === 'battle' ? '在秘境中选择奖励，并在休息时查看构筑变化。' : '带上构筑进入秘境，通过奖励继续完善。';
  const guideStep = guide.phase === 'shop' ? 1 : guide.phase === 'build' ? 2 : guide.phase === 'growth' ? 5 : guide.phase === 'battle' ? 4 : 3;
  const showGuide = ready && !loadFailed && !preview && guide.active;
  const targetFacility = showGuide && guide.expanded && !panel && !backpackOpen ? guidePanel : null;
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
      {facilities.map(facility => {
        const pointed = targetFacility === facility.id;
        const tipStyle = facility.id === 'character' ? { left: '105%', right: 'auto' } : undefined;
        return <button key={facility.id} className={`${s.facility} ${facility.area} ${pointed ? g.facilityTarget : ''}`} style={facility.id === 'shop' ? shopStyle : undefined} aria-label={`打开${facility.label}${pointed ? ' · 新手指引' : ''}`} onClick={() => openPanel(facility.id)}><span>◇　{facility.label}　◇</span><i aria-hidden="true" />{pointed && <small className={g.facilityTip} style={tipStyle}>{guideTitle}</small>}</button>;
      })}
      {showGuide && !panel && !backpackOpen && <TutorialCard floating title={guideTitle} text={guideText} step={guideStep} />}
      <div className={s.hint}>◇　 WASD 移动 · 点击场景设施打开界面　 ◇</div>
      <span className={s.version}>v{appVersion}</span>
      {error && !panel && <div className={s.error} role="alert">{error}</div>}
      {preview && <a className={s.preview} href="?mode=online">场景预览 · 进入本地账号模式 ↗</a>}
    </div>
    <dialog ref={dialog} className={`${s.dialog} ${panel === 'skills' ? s.skillDialog : ''} ${panel === 'shop' ? s.shopDialog : ''} ${panel === 'character' ? s.characterDialog : ''} ${panel === 'expeditions' ? s.expeditionDialog : ''}`} aria-labelledby="camp-panel-title" onCancel={event => { event.preventDefault(); closePanel(); }} onClick={event => { if (event.target === event.currentTarget) closePanel(); }}>
      <section className={`${s.panel} ${panel === 'skills' ? s.skillPanel : ''} ${panel === 'shop' ? s.shopPanel : ''} ${panel === 'character' ? s.characterPanel : ''} ${panel === 'expeditions' ? s.expeditionPanel : ''}`}>
        {panel !== 'shop' && panel !== 'skills' && panel !== 'expeditions' && panel !== 'character' && <header className={s.panelHeader}><div><small>林 间 营 地</small><h1 id="camp-panel-title">{panel ? titles[panel] : ''}</h1></div><button aria-label="关闭界面" disabled={busy || equipmentBusy} onClick={closePanel}>×</button></header>}
        <div className={`${s.panelBody} ${panel === 'skills' ? s.skillBody : ''} ${panel === 'character' ? s.characterBody : ''}`}>
          {panel !== 'expeditions' && <>{error && <p className={s.message} role="alert">{error}</p>}{notice && <p className={s.message} role="status">{notice}</p>}</>}
          {panel === 'character' && <CharacterUpgrade profile={props.profile} upgrade={props.upgradeCharacter} saveGrowth={props.saveCharacterGrowth} onBusyChange={setEquipmentBusy} onClose={closePanel} />}
          {panel === 'test-tools' && TestTools && <Suspense fallback={<p>正在加载测试工具…</p>}><TestTools addInventory={props.addTestInventory} loadAssets={props.loadTestAssets} adjustAssets={props.adjustTestAssets} onBusyChange={setEquipmentBusy} /></Suspense>}
          {panel === 'shop' && <Shop loadShop={preview ? undefined : props.loadShop} purchaseProduct={preview ? undefined : props.purchaseProduct} refreshShop={preview ? undefined : props.refreshShop} onBusyChange={setEquipmentBusy} onClose={closePanel} />}
          {panel === 'skills' && <SkillConstellation onClose={closePanel} onOpenExpeditions={openExpeditions} copyEquipment={props.copyEquipment} magicalAttack={stats.magicalAttack} attackSpeed={stats.attackSpeed} castingSpeed={stats.castingSpeed} energyCapacityBonus={stats.energyCapacityBonus} loadEquipment={preview ? undefined : props.loadEquipment} saveEquipment={preview ? undefined : props.saveEquipment} onBusyChange={setEquipmentBusy} />}
          {panel === 'expeditions' && <Expeditions unlockedDifficulties={props.unlockedDifficulties} rooms={rooms} busy={busy} error={error || notice} enterRoom={joinRoom} onClose={closePanel} />}
          {panel === 'history' && <>{history.length ? history.map(record => { const date = new Date(record.run.createdAt); const dateText = date.toLocaleString('zh-CN'); const difficulty = expeditionDifficulties[record.run.difficulty ?? 'normal'].name; const status = record.outcome === 'hell-victory' ? `${difficulty}·地狱20层通关` : record.outcome === 'failed' && record.baseCleared ? `${difficulty}已通关·地狱失败` : record.outcome === 'extracted' ? `${difficulty}·已安全提取` : record.run.status === 'completed' ? '已完成' : record.run.status === 'failed' ? '挑战结束' : '进行中 / 中断'; return <div className={s.row} key={record.runId}><div><b>{status}</b><small>{dateText}</small></div><span>{record.settled ? `金币 +${record.coins} · 素材 +${record.materials}` : '尚未结算'}</span></div>; }) : <div className={s.empty}><h2>旅程即将开始</h2><p>完成第一次秘境后，在这里回顾你的冒险与收获。</p></div>}</>}
          {panel === 'settings' && <><label className={s.option}><span>减少环境动态<small>减弱营地装饰光效</small></span><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} /></label><p className={s.subtle}>WASD 移动 · 点击设施打开系统 · Esc 关闭界面。打开界面或窗口失焦时，角色停止移动。</p>{preview ? <a className={s.link} href="?mode=online">进入本地账号模式 →</a> : <button onClick={() => { void logout(); }} disabled={busy}>退出账号</button>}</>}
          {panel === 'settings' && !preview && <TutorialSettings />}
        </div>{panel !== 'character' && panel !== 'skills' && panel !== 'expeditions' && <footer className={s.panelFooter}>营火常明，静候归人。<span>Esc 关闭</span></footer>}
      </section>
    </dialog>
  </main>;
}
