import { useState } from 'react';
import type { BuildStateData, PlayerView } from '@web-game-world/contracts';
import { buildCatalog, equippedIds } from '@web-game-world/simulation';
import { ShopIcon } from '../lobby/camp/shop-icon';
import { rewardPreview } from './reward-preview';
import { RewardDialog } from './reward-dialog';
import content from '../network/content';
import vitalityArt from './assets/vitality-reward.png';
import s from './reward-ui.module.css';

interface Props { state: BuildStateData; choice: BuildStateData['choices'][number]; player?: PlayerView; busy: boolean; disabled?: boolean; choose: (index: number, targetId?: string) => void }

export function RewardCards(props: Props) {
  const [detail, setDetail] = useState(-1);
  const [targets, setTargets] = useState<Record<number, string>>({});
  const [targetsOpen, setTargetsOpen] = useState(-1);
  const catalog = buildCatalog(content, props.state.items);
  const equipped = equippedIds(props.state.loadout);
  const targetsByOption = props.choice.options.map(option => catalog.filter(item => equipped.includes(item.id) && item.kind === option.itemId && (item.kind === 'heart' || item.kind === 'skill') && (item.level ?? 1) < 20));
  const selectedTargets = targetsByOption.map((items, index) => items.find(item => item.id === targets[index]) ?? items[0]);
  const views = props.choice.options.map((option, index) => { const context = { state: props.state, player: props.player, choice: props.choice, targetId: selectedTargets[index]?.id }; return rewardPreview(option, context); });
  const selected = views[detail];
  function closeDetails(): void { setDetail(-1); }
  function chooseTarget(index: number, id: string): void { setTargets(previous => ({ ...previous, [index]: id })); setTargetsOpen(-1); }
  return <>
    <div className={s.cards}>{views.map((view, index) => {
      const option = props.choice.options[index];
      const kind = option.kind === 'character' ? '角色成长' : option.kind === 'item' ? `获得${view.item?.kind === 'skill' ? '技能' : view.item?.kind === 'heart' ? '心法' : '辅助宝石'}` : view.item?.kind === 'heart' ? '心法强化' : '技能强化';
      const definition = view.item ? { ...view.item, id: view.item.definitionId ?? view.item.id } : undefined;
      const brief = view.item?.effect === 'chain-lightning' && option.kind === 'item' ? view.headline.split('，')[0].replace('瞬间连锁', '连锁命中 ') : view.item?.effect === 'homing' && option.kind === 'item' ? '投射物自动追踪' : view.headline;
      const headline = brief.replace('新增能力槽', '能力槽').replace('新增辅助槽', '辅助槽');
      const notes = option.kind === 'item' ? '领取到储备 · 装配后生效' : view.note;
      const rows = view.rows.slice(0, 3);
      const demand = view.rows.find(row => row.label.includes('需求'));
      if (demand && !rows.includes(demand)) rows[2] = demand;
      const isRefine = option.kind === 'refine';
      const hasDetails = Boolean(view.details || view.rows.length > rows.length);
      function pick(): void { props.choose(index, selectedTargets[index]?.id); }
      return <article className={s.card} key={index} data-reward-card={index}>
        <div className={s.category}>{kind}<button aria-label={`查看${view.title}详情`} className={s.info} onClick={() => setDetail(index)}>ⓘ</button></div>
        <div className={s.identity}><div className={s.art}>{definition ? <ShopIcon item={definition} size={76} /> : <img src={vitalityArt} alt="" />}</div><div className={s.name}><h2>{view.title}</h2>{isRefine ? <button className={s.target} aria-expanded={targetsOpen === index} disabled={props.busy || props.disabled || targetsByOption[index].length <= 1} onClick={() => setTargetsOpen(previous => previous === index ? -1 : index)}>强化目标 ⌄</button> : option.kind !== 'character' && <span className={s.level}>{view.level}</span>}{view.status && <small className={s.status}>{isRefine ? view.level : view.status}</small>}</div></div>
        {isRefine && targetsOpen === index && <div className={s.targetList}>{targetsByOption[index].map(item => <button key={item.id} onClick={() => chooseTarget(index, item.id)}>{item.name} · Lv.{item.level}{item.id === selectedTargets[index]?.id && ' ✓'}</button>)}</div>}
        <strong className={s.headline}>{headline}</strong>
        <dl className={s.facts}>{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.before !== undefined && <><span>{row.before}</span><i> → </i></>}<b data-tone={row.tone}>{row.after}</b></dd></div>)}</dl>
        <div className={s.description}>{notes && <p data-warning={notes.includes('缺能')}>{notes}</p>}{hasDetails && <button onClick={() => setDetail(index)}>效果详情 ›</button>}</div>
        <button className={s.select} disabled={props.busy || props.disabled || view.disabled} onClick={pick}>{props.busy ? '正在确认…' : view.action}</button>
      </article>;
    })}</div>
    {selected && <RewardDialog title={`${selected.title}详情`} close={closeDetails}><p>{selected.details || selected.headline}</p><dl className={s.facts}>{selected.rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.before !== undefined && <span>{row.before} → </span>}<b data-tone={row.tone}>{row.after}</b></dd></div>)}</dl>{selected.item?.kind === 'skill' && <p>基础消耗 {selected.item.cost} · 间隔 {selected.item.interval} 秒</p>}{selected.note && <p>{selected.note}</p>}</RewardDialog>}
  </>;
}
