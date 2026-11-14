import { expeditionDifficulties } from '@web-game-world/simulation';
import type { ExpeditionDifficultyData } from '@web-game-world/contracts';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, MouseEvent, SyntheticEvent } from 'react';
import type { LobbyViewProps } from '../../online/lobby-view';
import { useTutorial } from '../../online/tutorial/tutorial-context';
import { TutorialCard } from '../../online/tutorial/tutorial-ui';
import manifest from '../../network/content';
import portal from '../../../../../content/common/lobby/expedition-ui-portal.webp';
import g from '../../online/tutorial/tutorial.module.css';
import s from './expeditions.module.css';

interface ExpeditionsProps {
  unlockedDifficulties?: ExpeditionDifficultyData[];
  rooms: LobbyViewProps['rooms'];
  busy: boolean;
  error: string;
  enterRoom: LobbyViewProps['enterRoom'];
  onClose: () => void;
}

function roomPageSize(): number {
  if (window.innerWidth >= 600 && window.innerHeight < 430) return 1;
  return window.innerWidth < 600 || window.innerHeight < 600 ? 2 : 3;
}

export function Expeditions(props: ExpeditionsProps) {
  const guide = useTutorial();
  const [difficulty, setDifficulty] = useState<ExpeditionDifficultyData>('normal');
  const unlocked = props.unlockedDifficulties ?? ['normal'];
  const setting = expeditionDifficulties[difficulty];
  const [roomCode, setRoomCode] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(roomPageSize);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');
  const joining = useRef(false);
  const disabled = props.busy || pending !== null;
  const code = roomCode.trim();
  const count = props.rooms.length;
  const pageCount = Math.ceil(count / pageSize);
  const lastPage = Math.max(0, pageCount - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * pageSize;
  const visibleRooms = props.rooms.slice(start, start + pageSize);
  const highlightCreate = guide.expanded && (guide.phase === 'expedition' || guide.phase === 'battle');
  const feedback = localError || props.error;

  useEffect(() => {
    function resize(): void { const size = roomPageSize(); setPageSize(size); setPage(0); }
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); };
  }, []);

  async function enter(id?: string): Promise<void> {
    if (disabled || joining.current) return;
    joining.current = true; setPending(id ?? ''); setLocalError('');
    try { await props.enterRoom(id, difficulty); }
    catch (cause) { const message = cause instanceof Error ? cause.message : '连接房间失败，请稍后重试。'; setLocalError(message); }
    finally { joining.current = false; setPending(null); }
  }
  function createRoom(): void { void enter(); }
  function joinByCode(event: FormEvent<HTMLFormElement>): void { event.preventDefault(); if (code) void enter(code); }
  function changeCode(event: ChangeEvent<HTMLInputElement>): void { setRoomCode(event.target.value); }
  function openDetails(): void { setDetailsOpen(true); }
  function closeDetails(): void { setDetailsOpen(false); }
  function previousPage(): void { setPage(currentPage - 1); }
  function nextPage(): void { setPage(currentPage + 1); }

  return <div className={s.expeditions}>
    <header className={s.heading}><h1 id="camp-panel-title">秘境探索</h1><button type="button" className={s.close} aria-label="关闭秘境界面" onClick={props.onClose} disabled={disabled}>×</button></header>
    <div className={s.layout}>
      <section className={s.destination} aria-labelledby="expedition-name">
        <img className={s.portal} src={portal} alt="林地围猎的森林传送门" width={800} height={500} />
        <h2 id="expedition-name">{manifest.name}</h2>
        <p className={s.meta}>{manifest.players.min}–{manifest.players.max} 人 · 20关 · 约20–25分钟</p>
        <p className={s.summary}>限时生存通关，可继续挑战地狱20层</p>
        <button className={s.detailsLink} type="button" onClick={openDetails}>玩法详情 <span aria-hidden="true">ⓘ</span></button>
        <div className={s.difficulty} aria-label="选择秘境难度">{(['normal', 'hard', 'nightmare'] satisfies ExpeditionDifficultyData[]).map(value => {
          const available = unlocked.includes(value); const entry = expeditionDifficulties[value];
          function select(): void { setDifficulty(value); }
          return <button type="button" key={value} aria-pressed={difficulty === value} disabled={disabled || !available} onClick={select} title={available ? entry.name : '通关前一难度20关后解锁'}>{entry.name}{!available && ' · 未解锁'}</button>;
        })}</div>
        <p className={s.difficultyHint}>生命 ×{setting.health} · 伤害 ×{setting.damage} · 金币 ×{setting.coins}</p>
        <button className={`${s.action} ${s.create} ${highlightCreate ? g.target : ''}`} type="button" disabled={disabled} onClick={createRoom}>{pending === '' ? '正在创建…' : `创建${setting.name}房间`}</button>
        {guide.active && <div className={s.guide}><TutorialCard compact title={guide.phase === 'battle' ? '继续探索，完善构筑' : '进入第一次秘境'} text="创建房间或加入同行者，准备后开启秘境。" step={guide.phase === 'battle' ? 4 : 3} /></div>}
      </section>
      <section className={s.rooms} aria-label="加入房间">
        <h2 className={s.sectionTitle}>编号加入</h2>
        <form className={s.join} onSubmit={joinByCode}>
          <input aria-label="房间编号" placeholder="输入好友的房间编号" value={roomCode} maxLength={50} disabled={disabled} onChange={changeCode} autoComplete="off" autoCapitalize="off" spellCheck={false} />
          <button type="submit" className={s.action} disabled={disabled || !code}>{pending !== null && pending !== '' && pending === code ? '连接中…' : '加入'}</button>
        </form>
        <div className={s.roomHeading}><h2 className={s.sectionTitle}>等待中的房间 <span className={s.count}>{count}</span></h2></div>
        <div className={s.roomList} aria-label="等待中的房间列表" aria-busy={disabled}>
          {visibleRooms.map(room => {
            const full = room.clients >= room.maxClients;
            const label = pending === room.roomId ? '连接中…' : full ? '已满' : '加入';
            function join(): void { if (!full) void enter(room.roomId); }
            return <article key={room.roomId} className={s.room}>
              <div className={s.roomIdentity}><h3 title={room.name}>{room.name}</h3><span className={s.roomCode} title={room.roomId}>{expeditionDifficulties[room.difficulty ?? 'normal'].name} · {room.roomId}</span></div>
              <span className={s.occupancy}>{room.clients} / {room.maxClients} 人</span>
              <button type="button" className={s.action} disabled={disabled || full} onClick={join} aria-label={`加入房间 ${room.roomId}`}>{label}</button>
            </article>;
          })}
          {count === 0 && <div className={s.empty}><strong>暂无等待中的房间</strong><p>创建房间，邀请好友一起出发。</p></div>}
        </div>
        {pageCount > 1 && <nav className={s.pagination} aria-label="房间分页"><button type="button" className={s.action} aria-label="上一页房间" disabled={disabled || currentPage === 0} onClick={previousPage}>‹</button><span aria-live="polite">{currentPage + 1} / {pageCount}</span><button type="button" className={s.action} aria-label="下一页房间" disabled={disabled || currentPage === lastPage} onClick={nextPage}>›</button></nav>}
        {feedback && <p className={s.feedback} role="alert">{feedback}</p>}
      </section>
    </div>
    {detailsOpen && <ExpeditionDetails close={closeDetails} />}
  </div>;
}

function ExpeditionDetails(props: { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const current = dialog.current; current?.showModal(); return () => { current?.close(); }; }, []);
  function cancel(event: SyntheticEvent<HTMLDialogElement>): void { event.preventDefault(); event.stopPropagation(); props.close(); }
  function backdrop(event: MouseEvent<HTMLDialogElement>): void { event.stopPropagation(); if (event.target === event.currentTarget) props.close(); }
  return <dialog ref={dialog} className={s.detailDialog} aria-labelledby="expedition-details-title" onCancel={cancel} onClick={backdrop}>
    <header className={s.detailHeader}><h2 id="expedition-details-title">{manifest.name} · 玩法详情</h2><button type="button" className={s.close} onClick={props.close} aria-label="关闭玩法详情">×</button></header>
    <dl><div><dt>同行人数</dt><dd>{manifest.players.min}–{manifest.players.max} 人，可单人出发。</dd></div><div><dt>20关限时生存</dt><dd>基础20关约20–25分钟，计时结束后清理怪物并休息。通关可提取收益，或确认风险后继续地狱20层。</dd></div><div><dt>灵魂与复活</dt><dd>倒地后灵魂可移动，等待复活；全员成为灵魂后失败。地狱失败将失去包含基础20关奖励在内的全部待提取收益。</dd></div></dl>
  </dialog>;
}
