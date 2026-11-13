import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { isPartyBoardReady, loadPartyBoard, partyBoard, partyBoardPreview } from './party-assets';
import type { PartyViewProps } from '../../online/lobby-view';
import { campBackground, campPortrait } from '../camp/camp-assets';
import destination from '../../../../../content/common/lobby/camp-background.webp';
import manifest from '../../../../../content/packs/forest-survival/manifest.json';
import s from './party.module.css';

export function ExpeditionParty(props: PartyViewProps) {
  const { snapshot, playerId, busy, connection, error, ready, start, leave } = props;
  const [copyStatus, setCopyStatus] = useState('');
  const [pending, setPending] = useState<'ready' | 'start' | null>(null);
  const [actionError, setActionError] = useState('');
  const [boardReady, setBoardReady] = useState(isPartyBoardReady);
  const [boardFailed, setBoardFailed] = useState(false);
  const [boardAttempt, setBoardAttempt] = useState(0);
  const boardStyle: CSSProperties & { '--party-board': string } = { '--party-board': `url("${boardReady ? partyBoard : partyBoardPreview}")` };
  const codeInput = useRef<HTMLInputElement>(null);
  const mine = snapshot.players.find(player => player.id === playerId);
  const prepared = snapshot.players.filter(player => player.ready && player.connected).length;
  const disconnected = snapshot.players.filter(player => !player.connected).length;
  const remaining = snapshot.players.length - prepared;
  const resting = snapshot.stage === 'rest';
  const connected = connection === '已连接权威房间';
  const host = snapshot.hostId === playerId;
  const disabled = busy || !connected || !mine?.connected || pending !== null;
  const capacity = manifest.players.max;
  const emptyCount = Math.max(0, capacity - snapshot.players.length);
  const emptySlots = Array.from({ length: emptyCount });
  const seconds = Math.ceil(snapshot.seconds);
  const hint = resting ? `${seconds} 秒后统一进入林地` : disconnected ? `有 ${disconnected} 位同行者连接中断，等待重连` : remaining ? `还有 ${remaining} 位同行者尚未准备` : host ? '所有同行者已准备，可以开启秘境' : '所有同行者已准备，等待房主开启';

  useEffect(() => { setPending(null); }, [mine?.ready, snapshot.stage, error, connected]);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => { setPending(null); setActionError('尚未收到操作确认，请稍后重试。'); }, 8000);
    return () => window.clearTimeout(timer);
  }, [pending]);
  useEffect(() => { setCopyStatus(''); }, [snapshot.roomId]);

  useEffect(() => {
    let active = true;
    setBoardFailed(false);
    const loading = loadPartyBoard('high');
    void loading.then(() => { if (active) setBoardReady(true); }).catch(() => { if (active) setBoardFailed(true); });
    return () => { active = false; };
  }, [boardAttempt]);

  function retryBoard() { setBoardAttempt(previous => previous + 1); }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(snapshot.roomId);
      setCopyStatus('已复制');
    } catch {
      codeInput.current?.focus();
      codeInput.current?.select();
      setCopyStatus('请长按或按 Ctrl+C 复制编号');
    }
  }
  function toggleReady() { setActionError(''); setPending('ready'); ready(); }
  function begin() { setActionError(''); setPending('start'); start(); }
  async function exitParty() {
    try { await leave(); } catch { setActionError('离开队伍失败，请稍后重试。'); }
  }

  return <main className={`${s.page} ${resting ? s.resting : ''}`} style={{ backgroundImage: `url(${campBackground})` }}>
    <section className={s.board} style={boardStyle} aria-labelledby="party-heading">
      <header className={s.heading}><h1 id="party-heading">{resting ? '秘境大厅' : '远征集结'}</h1></header>
      {!boardReady && <div className={s.artStatus} role="status">{boardFailed ? <>背景暂未加载完整，可继续组队。<button onClick={retryBoard}>重新加载背景</button></> : '正在完善背景画面，可正常组队…'}</div>}
      <div className={s.content}>
        <aside className={s.destination}>
          <h2>森语遗迹</h2><span className={s.subtitle}>林地围猎</span>
          <img className={s.landscape} src={destination} alt="青绿色传送门掩映在林间遗迹之中" />
          <p>与同行者深入林地，迎战不断涌来的怪潮。</p>
          <div className={s.tags}><span>自动战斗</span><span>协作生存</span><span>持续波次</span></div>
          <details className={s.rules}><summary>查看秘境说明</summary><p>全员准备后由房主开启，先进入秘境大厅等待，再统一出发。开局后不接受新玩家。</p><p>怪物随波次和入场人数增强。清空怪物后可原地休息，灵魂状态可等待复活；全员进入灵魂后结束并结算。</p></details>
          <div className={s.roomCode}><label htmlFor="party-code">房间编号</label><input id="party-code" ref={codeInput} value={snapshot.roomId} readOnly /><button onClick={copyCode}>复制编号</button></div>
          <small className={s.copyStatus} role="status">{copyStatus}</small>
        </aside>
        <section className={s.team} aria-label="同行者名单">
          <div className={s.teamHeading}><h2>同行者 <span>{snapshot.players.length} / {capacity}</span></h2><span>{resting ? '即将出发' : `已准备 ${prepared} / ${snapshot.players.length}`}</span></div>
          <div className={s.members}>
            {snapshot.players.map(player => <article key={player.id} className={`${s.member} ${player.id === playerId ? s.mine : ''} ${!player.connected ? s.offline : ''}`}>
              {player.id === snapshot.hostId && <span className={s.host}>房主</span>}
              <img src={campPortrait} alt="" className={s.portrait} />
              <div className={s.memberText}><b title={player.name}>{player.name}</b>{player.id === playerId && <small>你</small>}<span className={player.connected && player.ready ? s.ready : s.unready}>{!player.connected ? '连接中断' : resting ? '等待出发' : player.ready ? '✓ 已准备' : '未准备'}</span></div>
            </article>)}
            {emptySlots.map((_, index) => <div key={`empty-${index}`} className={s.empty}><span className={s.emptySeal} /><span>{resting ? '空位' : '等待加入'}</span></div>)}
          </div>
        </section>
      </div>
      <footer className={s.footer}>
        {(!resting || connection === '重连失败') && <button className={s.leave} disabled={busy} onClick={exitParty}>离开队伍</button>}
        <p className={s.hint} role="status">{pending === 'start' ? '正在开启秘境…' : hint}</p>
        {!resting && <div className={s.actions}><button className={s.prepare} disabled={disabled} onClick={toggleReady}>{pending === 'ready' ? '正在确认…' : mine?.ready ? '取消准备' : '准备'}</button>{host && <button className={s.start} disabled={disabled || remaining > 0 || !snapshot.players.length} onClick={begin}>开启秘境</button>}</div>}
      </footer>
      {(error || actionError || !connected) && <div className={s.feedback} role="alert">{error || actionError || connection || '正在连接房间…'}</div>}
    </section>
  </main>;
}
