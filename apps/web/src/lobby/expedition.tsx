import { useEffect } from 'react';
import type { Dispatch } from 'react';
import { companions, finalCoins, finalMaterials, getRift, restDuration } from '../app/demo-data';
import type { DemoAction, DemoState } from '../app/demo-state';
import { Button, Icon, PortalArt, RoleFigure } from '../app/ui';
import { GameView } from '../game/game-view';
import s from '../app/app.module.css';

export function Expedition({ state, dispatch }: { state: DemoState; dispatch: Dispatch<DemoAction> }) {
  const rift = getRift(state.riftId);
  const profile = state.profile;

  useEffect(() => {
    if (state.stage !== 'rest') return;
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => window.clearInterval(timer);
  }, [state.stage, dispatch]);

  if (!profile) return null;

  function addCompanion() { dispatch({ type: 'add-companion' }); }
  function start() { dispatch({ type: 'start' }); }
  function leave() { dispatch({ type: 'leave-room' }); }
  function completeRound() { dispatch({ type: 'round-complete' }); }
  function next() { dispatch({ type: 'continue' }); }
  function returnLobby() { dispatch({ type: 'return-lobby' }); }

  const members = [profile.name, ...companions];
  const slots = members.map((member, index) => {
    const occupied = index < state.partySize;
    return <div key={member} className={occupied ? s.member : `${s.member} ${s.memberEmpty}`}><div className={s.memberAvatar}>{occupied ? <RoleFigure role={index === 0 ? profile.role : index % 2 ? 'guardian' : 'mage'} small /> : <span>＋</span>}</div><strong>{occupied ? member : '等待同行者'}</strong><span>{index === 0 ? '你 · 房主' : occupied ? '模拟同行者' : '空闲席位'}</span>{occupied && <span className={s.ready}><Icon name="check" size={14} />已就绪</span>}</div>;
  });
  const steps = rift.rounds.map((name, index) => {
    const finished = index < state.round || state.stage === 'final-result';
    const active = index === state.round;
    const className = finished ? `${s.roundStep} ${s.stepDone}` : active ? `${s.roundStep} ${s.stepActive}` : s.roundStep;
    return <div className={className} key={name}><span>{finished ? <Icon name="check" size={16} /> : `0${index + 1}`}</span><div><small>小秘境 {index + 1}</small><strong>{name}</strong></div></div>;
  });
  const total = state.scores.reduce((sum, score) => sum + score, 0);
  const scoreRows = state.scores.map((score, index) => <div className={s.resultRow} key={rift.rounds[index]}><span><i>0{index + 1}</i>{rift.rounds[index]}</span><strong>{score} <small>积分</small></strong></div>);

  if (state.stage === 'room') return <section><div className={s.pageHeading}><div><span className={s.eyebrow}>GATHER YOUR PARTY</span><h1>旅途，等一个同行的人。</h1><p className={s.muted}>房间已创建。邀请同行者，一起走进 {rift.title}。</p></div><Button secondary onClick={leave}>离开房间 <Icon name="exit" size={17} /></Button></div><div className={s.roomBanner}><div><span className={s.tag}>本地演示房间</span><h2>{rift.title}</h2><p>共 3 轮小秘境 · 每轮结算 · 轮间成长</p></div><div className={s.roomArtwork}><PortalArt variant={rift.id} /></div></div><div className={s.sectionHeading}><h2>同行者 <span className={s.count}>{state.partySize}/4</span></h2><span className={s.caption}>当前人数为演示设置，不代表正式开局规则</span></div><div className={s.members}>{slots}</div><div className={s.roomActions}><Button secondary onClick={addCompanion} disabled={state.partySize >= 4}>添加模拟同行者 <Icon name="users" size={17} /></Button><Button onClick={start} disabled={state.partySize < 2}>开启秘境 <Icon name="arrow" /></Button></div><p className={s.caption}>此版本未连接多人服务器。添加一位模拟同行者后，即可体验完整流程。</p></section>;

  if (state.stage === 'final-result') return <section className={s.resultPage}><span className={s.resultEmblem}><Icon name="portal" size={42} /></span><span className={s.eyebrow}>A JOURNEY TO REMEMBER</span><h1>此行圆满，下次再见。</h1><p className={s.muted}>{rift.title} · 全部 {rift.rounds.length} 轮已完成</p><div className={s.resultSummary}><div><span>个人累计积分</span><strong>{total}<small> PT</small></strong></div><div><span>同行人数</span><strong>{state.partySize}<small> 人</small></strong></div></div><div className={s.resultDetails}>{scoreRows}</div><h3>秘境最终奖励</h3><div className={s.rewardGrid}><div><Icon name="coin" size={26} /><strong>+ {finalCoins}</strong><span>演示金币</span></div><div><Icon name="gem" size={26} /><strong>+ {finalMaterials}</strong><span>演示经营素材</span></div></div><p className={s.caption}>返回时一次性加入本机演示档案，正式奖励规则尚未确定。</p><Button onClick={returnLobby}>领取演示奖励并返回大厅 <Icon name="arrow" /></Button></section>;

  return <section><div className={s.pageHeading}><div><span className={s.eyebrow}>EXPEDITION IN PROGRESS</span><h1>{rift.title}</h1><p className={s.muted}>与 {state.partySize - 1} 位模拟同行者，一起探索这一程。</p></div><span className={s.outlinePill}>第 {state.round + 1} / {rift.rounds.length} 轮</span></div><div className={s.roundSteps}>{steps}</div>
    {state.stage === 'rest' && <div className={s.restLayout}><div className={s.restMain}><div className={s.restArt}><PortalArt variant={rift.id} /></div><div className={s.restContent}><span className={s.eyebrow}>A MOMENT TO BREATHE</span><h2>{state.round === 0 ? '先歇歇脚，冒险即将开始。' : '回到秘境大厅，准备新的成长。'}</h2><p>下一站 · {rift.rounds[state.round]}</p><div className={s.countdown}><strong>{state.seconds}<small>秒</small></strong><span>倒计时结束后，全体进入下一轮</span></div><progress max={restDuration} value={restDuration - state.seconds} aria-label="休息等待进度" /></div></div><aside className={s.growthPanel}><span className={s.tag}>秘境大厅</span><h3>{state.round > 0 ? '选择一份成长' : '整装待发'}</h3><p className={s.muted}>{state.round > 0 ? '选一份祝福，带上它继续旅途。' : '首次休息后进入第一轮。完成小秘境后，将回到这里成长。'}</p>{state.round > 0 && ['轻盈步伐', '坚定意志', '星光眷顾'].map((choice) => {
      const selected = state.growth[state.round - 1] === choice;
      const picked = state.growth.length >= state.round;
      function choose() { dispatch({ type: 'grow', choice }); }
      return <button className={selected ? `${s.growthChoice} ${s.selected}` : s.growthChoice} key={choice} disabled={picked} onClick={choose}><Icon name="spark" size={18} />{choice}{selected && <Icon name="check" size={16} />}</button>;
    })}<p className={s.caption}>18 秒等待及祝福为演示设置，祝福只记录选择，不改变战斗属性。未选择也会按时进入下一轮。</p><div className={s.inlineStat}><span>当前累计积分</span><strong>{total}</strong></div></aside></div>}
    {state.stage === 'play' && <><div className={s.sectionHeading}><div><h2>{rift.rounds[state.round]}</h2><p className={s.caption}>收集 5 枚星屑，即可完成本轮演示玩法。</p></div><span className={s.tag}>本地交互演示</span></div><GameView key={state.round} theme={rift.id} partySize={state.partySize} onComplete={completeRound} /></>}
    {state.stage === 'round-result' && <div className={s.roundResult}><span className={s.resultEmblem}><Icon name="check" size={38} /></span><span className={s.eyebrow}>ONE STEP FURTHER</span><h2>{rift.rounds[state.round]} · 已完成</h2><p className={s.muted}>星屑已集齐，属于这一轮的收获已记录。</p><div className={s.roundScore}><small>本轮个人演示积分</small><strong>+ {state.scores[state.round]}</strong><span>收集星屑 5 / 5 · 本轮奖励：成长机会</span></div><p className={s.caption}>单轮奖励仅展示流程，不发放永久金币；具体用途和带出规则待确定。</p><Button onClick={next}>{state.round + 1 < rift.rounds.length ? '返回秘境大厅成长' : '前往秘境最终结算'}<Icon name="arrow" /></Button></div>}
  </section>;
}
