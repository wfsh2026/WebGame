import { useState } from 'react';
import type { Dispatch } from 'react';
import { getRole, rifts } from '../app/demo-data';
import type { DemoAction, DemoState } from '../app/demo-state';
import { Button, Icon, PortalArt, RoleFigure } from '../app/ui';
import s from '../app/app.module.css';

export function Lobby({ state, dispatch }: { state: DemoState; dispatch: Dispatch<DemoAction> }) {
  const [filter, setFilter] = useState('全部秘境');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const profile = state.profile;
  if (!profile) return null;
  const role = getRole(profile.role);
  const activePreview = rifts.find((rift) => rift.id === preview);

  function upgrade() { dispatch({ type: 'upgrade' }); }
  function buy() { dispatch({ type: 'buy' }); }

  if (state.tab === 'character') return <section className={s.panelPage}><span className={s.eyebrow}>YOUR ADVENTURER</span><h1>每一次出发，都更进一步。</h1><p className={s.muted}>培养你的冒险者，为下一场旅途做好准备。</p><div className={s.characterPanel}><div className={s.characterPortrait}><RoleFigure role={role.id} /><span>{role.title}</span></div><div><span className={s.tag}>初始角色</span><h2>{profile.name} · {role.name}</h2><p>{role.description}</p><div className={s.statRow}><div><small>成长等级</small><strong>Lv. {profile.level}</strong></div><div><small>已完成秘境</small><strong>{profile.runs} 次</strong></div><div><small>经营素材</small><strong>{profile.materials}</strong></div></div><Button onClick={upgrade} disabled={profile.coins < 200 || profile.materials < 3}>成长一级 · 200 金币 + 3 素材</Button><p className={s.caption}>演示成长仅改变本地等级展示，不影响玩法判定。</p></div></div></section>;

  if (state.tab === 'supplies') return <section className={s.panelPage}><span className={s.eyebrow}>PACK LIGHT. GO FAR.</span><h1>行囊里，装一点从容。</h1><p className={s.muted}>准备物资，再去看看更远的风景。</p><div className={s.shopGrid}><article className={s.shopCard}><span className={s.itemArt}>✚</span><span className={s.tag}>基础物资</span><h2>旅行补给包</h2><p>一份安心，留给下一次出发。</p><div className={s.cardMeta}><span>已持有 {profile.supplies} 份</span><strong>60 金币</strong></div><Button onClick={buy} disabled={profile.coins < 60}>购买补给 <Icon name="bag" /></Button></article><article className={s.softPanel}><Icon name="bag" size={32} /><h3>你的行囊</h3><p>旅行补给包 × {profile.supplies}</p><p className={s.caption}>演示物资仅用于购买与背包展示。实际携带、使用和消耗规则待确定。</p></article></div></section>;

  if (state.tab === 'history') return <section className={s.panelPage}><span className={s.eyebrow}>THE PATH YOU WALKED</span><h1>旅途，会留下回声。</h1><div className={s.emptyState}><Icon name="history" size={44} /><h2>已完成 {profile.runs} 次完整秘境</h2><p>当前演示档案仅保存完成次数，详细战报将在接入服务后提供。</p><Button onClick={() => dispatch({ type: 'tab', tab: 'explore' })}>前往探索 <Icon name="arrow" /></Button></div></section>;

  const visibleRifts = rifts.filter((rift) => {
    const keyword = query.trim();
    const matchesType = filter === '全部秘境' || rift.type === filter;
    const matchesQuery = rift.title.includes(keyword) || rift.description.includes(keyword);
    return matchesType && matchesQuery;
  });
  const filters = ['全部秘境', '探索', '收集'].map((label) => {
    function select() { setFilter(label); }
    const className = filter === label ? s.filterActive : '';
    return <button key={label} className={className} onClick={select} aria-pressed={filter === label}>{label}</button>;
  });
  const cards = visibleRifts.map((rift) => {
    function create() { dispatch({ type: 'create-room', riftId: rift.id }); }
    function details() { setPreview(rift.id); }
    return <article className={s.riftCard} key={rift.id}><button className={s.cardArt} onClick={details} aria-label={`查看${rift.title}详情`}><PortalArt variant={rift.id} /><span className={s.artTag}>{rift.difficulty}秘境</span><span className={s.cardNumber}>{rift.number}</span></button><div className={s.cardBody}><div className={s.cardTitle}><h3>{rift.title}</h3><span className={s.tag}>{rift.type}</span></div><p>{rift.description}</p><div className={s.cardMeta}><span><Icon name="portal" size={15} />3 轮演示</span><span><Icon name="users" size={15} />模拟组队</span></div><button className={s.cardAction} onClick={create}>创建房间 <Icon name="arrow" size={18} /></button></div></article>;
  });

  return <>
    <section className={s.hero}><div className={s.heroCopy}><span className={s.eyebrow}>THE NEXT ADVENTURE IS YOURS</span><h1>此刻出发，<br />去遇见新的可能。</h1><p>每一道门后，都是不同的世界。<br />选择一处秘境，开启你的下一章。</p><div className={s.heroNote}><span className={s.smallLine} />探索 · 成长 · 再次出发</div></div><div className={s.heroArt}><PortalArt large /><span className={s.heroStamp}>EXPLORE<br /><b>THE UNKNOWN</b></span></div></section>
    <section><div className={s.sectionHeading}><div><span className={s.eyebrow}>CHOOSE YOUR RIFT</span><h2>秘境探索 <span className={s.count}>{rifts.length}</span></h2></div><span className={s.caption}><i className={s.statusDot} />所有演示秘境均可探索</span></div><div className={s.filterBar}><div className={s.filters}>{filters}</div><label className={s.search}><Icon name="compass" size={17} /><input placeholder="寻找一处秘境…" value={query} onChange={(event) => { const value = event.target.value; setQuery(value); }} aria-label="搜索秘境" /></label></div><div className={s.riftGrid}>{cards}</div>{cards.length === 0 && <div className={s.emptyState}><h3>还没有找到这处秘境</h3><p>试试其他名字，或切换分类。</p></div>}</section>
    <section className={s.journeyStrip}><span className={s.journeyIcon}><Icon name="compass" size={28} /></span><div><h3>好的冒险，从不只有终点。</h3><p>在秘境大厅休整，在每一轮挑战中成长，与同行者一起走到最后。</p></div><span className={s.stripLabel}>ONE JOURNEY, MANY STORIES</span></section>
    {activePreview && <div className={s.modalBackdrop} onClick={() => setPreview(null)}><section className={s.modal} role="dialog" aria-modal="true" aria-label="秘境详情" onClick={(event) => event.stopPropagation()}><PortalArt variant={activePreview.id} /><div className={s.modalBody}><span className={s.eyebrow}>{activePreview.subtitle}</span><h2>{activePreview.title}</h2><p>{activePreview.description}</p><ol className={s.roundList}>{activePreview.rounds.map((name) => <li key={name}>{name}</li>)}</ol><p className={s.caption}>每轮均为收集星屑的交互演示；不同主题的正式玩法尚未实现。</p><Button onClick={() => { dispatch({ type: 'create-room', riftId: activePreview.id }); setPreview(null); }}>创建房间</Button><Button secondary onClick={() => setPreview(null)}>关闭详情</Button></div></section></div>}
  </>;
}
