import { useEffect, useReducer, useState } from 'react';
import { demoReducer, initialState, persistProfile } from './demo-state';
import type { LobbyTab } from './demo-state';
import { getRole } from './demo-data';
import { Icon, RoleFigure } from './ui';
import { Onboarding } from '../lobby/onboarding';
import { Lobby } from '../lobby/lobby';
import { Expedition } from '../lobby/expedition';
import { CombatLab } from '../combat-lab/combat-lab';
import s from './app.module.css';

const navigation: { id: LobbyTab; title: string; icon: 'compass' | 'person' | 'bag' | 'history'; caption: string }[] = [
  { id: 'explore', title: '秘境探索', icon: 'compass', caption: '探索未知，开启旅程' },
  { id: 'character', title: '我的角色', icon: 'person', caption: '让每一次成长，都有意义' },
  { id: 'supplies', title: '物资行囊', icon: 'bag', caption: '出发前，再准备一点' },
  { id: 'history', title: '冒险记录', icon: 'history', caption: '记住走过的每一步' },
];

export function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    function navigate() { setHash(window.location.hash); }
    window.addEventListener('hashchange', navigate);
    return () => { window.removeEventListener('hashchange', navigate); };
  }, []);
  return hash === '#combat-lab' ? <CombatLab /> : <DemoApp />;
}

function DemoApp() {
  const [state, dispatch] = useReducer(demoReducer, undefined, initialState);
  const [saved, setSaved] = useState(true);
  const profile = state.profile;
  const inLobby = state.stage === 'lobby';
  const activeNav = navigation.find((item) => item.id === state.tab) ?? navigation[0];

  useEffect(() => {
    const success = persistProfile(state.profile);
    setSaved(success);
  }, [state.profile]);

  function register(name: string) { dispatch({ type: 'register', name }); }
  function chooseRole(role: 'ranger' | 'guardian' | 'mage') { dispatch({ type: 'choose-role', role }); }

  if (state.stage === 'account' || state.stage === 'role') return <><a className={s.labEntry} href="#combat-lab">战斗实验室 ↗</a><Onboarding choosingRole={state.stage === 'role'} name={state.draftName} onRegister={register} onChoose={chooseRole} /></>;
  if (!profile) return null;
  const role = getRole(profile.role);
  const navItems = navigation.map((item) => {
    function select() { dispatch({ type: 'tab', tab: item.id }); }
    const className = inLobby && state.tab === item.id ? `${s.navItem} ${s.navActive}` : s.navItem;
    return <button key={item.id} className={className} onClick={select} disabled={!inLobby} aria-current={inLobby && state.tab === item.id ? 'page' : undefined}><Icon name={item.icon} /><span>{item.title}</span>{inLobby && state.tab === item.id && <i />}</button>;
  });

  return <div className={s.shell}>
    <aside className={s.sidebar}><a href="/" className={s.brand} onClick={(event) => event.preventDefault()}><span className={s.brandMark}><Icon name="portal" size={25} /></span><span>秘境之间<small>INTO THE RIFT</small></span></a><div className={s.navLabel}>你的冒险 / ADVENTURE</div><nav aria-label="主导航">{navItems}{inLobby && <a className={s.navItem} href="#combat-lab"><Icon name="spark" /><span>战斗实验室 ↗</span></a>}</nav><div className={s.sidebarNote}><Icon name="spark" size={24} /><h4>下一段故事，<br />等你来开启。</h4><p>去探索，去遇见，<br />成为更好的冒险者。</p><span>KEEP EXPLORING ↗</span></div><div className={s.sidebarBottom}><span className={s.versionDot} />网页原型 <span>v0.1</span></div></aside>
    <div className={s.mainShell}><header className={s.topbar}><div className={s.breadcrumb}>冒险者营地 <span>/</span> <strong>{inLobby ? activeNav.title : state.stage === 'room' ? '准备房间' : '秘境旅程'}</strong></div><div className={s.wallet}><span title="演示金币"><Icon name="coin" size={18} />{profile.coins}</span><span title="演示经营素材"><Icon name="gem" size={18} />{profile.materials}</span><span className={s.profileMini}><RoleFigure role={role.id} small /><b>{profile.name}</b></span></div></header>
    <main className={s.main}><div className={s.welcomeRow}><span>{inLobby ? `你好，${profile.name}。今天也有值得期待的风景。` : '这一程，和同行者一起走到最后。'}</span><span className={s.demoPill}><i className={s.statusDot} />本地体验 · 模拟数据</span></div>{!saved && <div className={s.storageWarning} role="status">浏览器无法保存演示档案，刷新后数据可能丢失。</div>}{inLobby ? <Lobby state={state} dispatch={dispatch} /> : <Expedition state={state} dispatch={dispatch} />}</main>
    <footer className={s.footer}><span>秘境之间 · 每一次出发，都有新的可能</span><span>界面与流程原型 · 未接入真实账号 / 多人服务{!inLobby ? ' · 刷新将结束本次演示' : ''}</span></footer></div>
  </div>;
}
