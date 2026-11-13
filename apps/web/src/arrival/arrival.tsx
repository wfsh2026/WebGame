import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import type { AuthViewProps } from '../online/lobby-view';
import { appVersion } from '../app-version';
import { ForestSound } from './forest-sound';
import background from './assets/arrival-background.webp';
import s from './arrival.module.css';

const seenKey = 'web-game-world.arrival-seen.v1';
const sound = new ForestSound();

function shouldPlay(): boolean {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches) return false;
  try { return !sessionStorage.getItem(seenKey) && !sessionStorage.getItem('web-game-world.online-room.v1'); }
  catch { return true; }
}

function Scenery() {
  return <div className={s.scenery} aria-hidden="true"><img className={s.landscape} src={background} alt="" /><div className={s.shade} /><div className={s.portal} /><div className={s.fire} /><div className={s.mist} /><div className={s.motes}>{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ left: `${8 + index * 7}%`, top: `${48 + index % 4 * 12}%`, animationDelay: `${index * -.7}s` }} />)}</div><div className={s.leaves} /></div>;
}

function Title() {
  return <div className={s.title}><span className={s.titleMark} aria-hidden="true">◇</span><h1>林间秘境</h1><p><span aria-hidden="true">◇</span> 林火未熄，旅程将启 <span aria-hidden="true">◇</span></p></div>;
}

function Leaf() {
  return <svg viewBox="0 0 60 60" aria-hidden="true"><path d="M6 54Q21 26 51 8M18 34Q2 32 7 19Q22 20 18 34ZM28 24Q16 12 27 7Q38 12 28 24ZM30 25Q45 28 47 17Q36 12 30 25ZM17 38Q33 43 37 31Q22 26 17 38Z" /></svg>;
}

export function ArrivalGate({ children, play }: { children: ReactNode; play?: boolean }) {
  const [playing, setPlaying] = useState(() => play ?? shouldPlay());
  const [loaded, setLoaded] = useState(false);
  const skip = useRef<HTMLButtonElement>(null);
  function finish(): void {
    try { sessionStorage.setItem(seenKey, '1'); } catch { /* 页面内仍可继续。 */ }
    setPlaying(false);
  }
  useEffect(() => {
    if (!playing) return;
    const image = new Image();
    const ready = () => setLoaded(true);
    image.onload = ready;
    image.onerror = ready;
    image.src = background;
    const fallback = window.setTimeout(ready, 4000);
    return () => { window.clearTimeout(fallback); image.onload = null; image.onerror = null; };
  }, [playing]);
  useEffect(() => {
    if (!playing || !loaded) return;
    skip.current?.focus();
    const timer = window.setTimeout(finish, 7000);
    return () => window.clearTimeout(timer);
  }, [playing, loaded]);
  useEffect(() => {
    if (playing) return;
    const target = document.querySelector<HTMLElement>('[data-arrival-focus]');
    target?.focus();
  }, [playing]);
  return <><div inert={playing} aria-hidden={playing || undefined}>{children}</div>{playing && <section className={`${s.root} ${s.opening} ${loaded ? s.running : ''}`} aria-label="林间营地开场动画"><Scenery /><Title /><p className={s.openingCaption} role="status">{loaded ? '循着微光，抵达旅程的起点。' : '正在点亮林间营地…'}</p><button ref={skip} type="button" className={s.skip} onClick={finish}>跳过开场 <span aria-hidden="true">›</span></button></section>}</>;
}

export function ArrivalAuth(props: AuthViewProps) {
  const { name, password, login, busy, restoring, error, changeName, changePassword, changeMode, authenticate } = props;
  const [visible, setVisible] = useState(false);
  const [replay, setReplay] = useState(0);
  const [audible, setAudible] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { return () => { sound.stop(); }; }, []);
  function editName(event: ChangeEvent<HTMLInputElement>): void { const value = event.target.value; changeName(value); }
  function editPassword(event: ChangeEvent<HTMLInputElement>): void { const value = event.target.value; changePassword(value); }
  function togglePassword(): void { setVisible(!visible); }
  function switchMode(): void { setVisible(false); changeMode(); input.current?.focus(); }
  function replayOpening(): void {
    try { sessionStorage.removeItem(seenKey); } catch { /* 保持当前界面可用。 */ }
    setReplay(replay + 1);
  }
  async function toggleSound(): Promise<void> {
    if (audible) { sound.stop(); setAudible(false); return; }
    const started = await sound.start();
    setAudible(started);
  }
  return <ArrivalGate key={replay} play={replay > 0}><main className={s.root}>
    <Scenery /><Title />
    <section className={s.card} aria-labelledby="arrival-heading">
      <div className={s.banner} aria-hidden="true">✧</div>
      <header><h2 id="arrival-heading">{login ? '欢迎归来' : '开启旅程'}</h2><div className={s.ornament} aria-hidden="true">───── ◇ ─────</div></header>
      {restoring ? <div className={s.restoring} role="status">正在恢复你的旅程…</div> : <form onSubmit={authenticate}>
        <fieldset disabled={busy}>
          <label className={s.field} htmlFor="arrival-account">账号</label>
          <input ref={input} data-arrival-focus id="arrival-account" autoComplete="username" placeholder="请输入账号" value={name} minLength={2} maxLength={20} required onChange={editName} />
          <label className={s.field} htmlFor="arrival-password">密码</label>
          <div className={s.password}><input id="arrival-password" type={visible ? 'text' : 'password'} autoComplete={login ? 'current-password' : 'new-password'} placeholder={login ? '请输入密码' : '设置密码，至少 8 位'} value={password} minLength={8} maxLength={72} required onChange={editPassword} /><button className={s.eye} type="button" aria-label={visible ? '隐藏密码' : '显示密码'} aria-pressed={visible} onClick={togglePassword}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visible && <path d="m3 3 18 18" />}</svg></button></div>
          <div className={s.feedback} aria-live="polite">{error && <p role="alert">{error}</p>}{!login && !error && <p className={s.hint}>创建账号后，即可塑造你的第一位冒险者。</p>}</div>
          <button className={s.primary} type="submit">{busy ? '正在连接…' : login ? '登录游戏' : '创建账号'}</button>
          <button className={s.switch} type="button" onClick={switchMode}>{login ? '创建新账号' : '已有账号，去登录'}</button>
        </fieldset>
      </form>}
      <span className={s.cornerLeft}><Leaf /></span><span className={s.cornerRight}><Leaf /></span>
    </section>
    <footer className={s.footer}><span>内部测试 · v{appVersion}</span><div><button type="button" onClick={toggleSound} aria-pressed={audible}>{audible ? '♫ 关闭声音' : '♪ 开启声音'}</button><button type="button" onClick={replayOpening}>↻ 重播开场</button></div></footer>
  </main></ArrivalGate>;
}
