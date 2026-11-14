import { useState } from 'react';
import type { EquipmentLoadoutData, EquipmentStateData } from '@web-game-world/contracts';
import { abilityGrowthRoute, abilityGrowthSummary, activationSlotLevels, equipmentKindName, equipmentRuntime, heartCapacity, heartCostMultiplier, supportAssignable, supportCompatible } from '@web-game-world/simulation';
import type { EquipmentItem } from '@web-game-world/simulation';
import { equipmentDescription, displayNumber } from '../../hud/display-number';
import { BannerDetails } from '../../hud/banner-details';
import { AttackRhythm } from '../../online/attack-rhythm';
import manifest from '../../network/content';
import { SkillArt, type SkillSelection } from './skill-board';
import s from './skill-loadout.module.css';

interface Props { state: EquipmentStateData; catalog: EquipmentItem[]; selection: SkillSelection; attackSpeed: number; castingSpeed: number; capacityBonus: number; magicalAttack?: number; canEdit: boolean; choose: (target: SkillSelection) => void; equip: (item: EquipmentItem) => void; unequip: () => void }

export function SkillDetails(props: Props) {
  const [bagOpen, setBagOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const loadout = props.state.loadout;
  const target = props.selection;
  const slot = loadout.slots[target.branch];
  const owner = props.catalog.find(item => item.id === slot?.itemId);
  const selectedId = target.kind === 'heart' ? loadout.heart : target.kind === 'ability' ? slot?.itemId : slot?.supports[target.socket];
  const item = props.catalog.find(entry => entry.id === selectedId);
  const runtime = equipmentRuntime(loadout, manifest, props.state.items);
  const branch = runtime.branches.find(entry => entry.item.id === item?.id);
  const heart = props.catalog.find(entry => entry.id === loadout.heart);
  const active = target.kind === 'heart' || Boolean(heart && target.branch < heart.slots && (target.kind === 'ability' || owner && target.socket < owner.supportSlots && item && supportCompatible(item, owner)));
  const showingBag = bagOpen || !item;
  const kindName = target.kind === 'heart' ? '心法' : target.kind === 'ability' ? '技能' : '辅助';
  const occupied = [loadout.heart, ...loadout.slots.flatMap(entry => entry ? [entry.itemId, ...entry.supports] : [])];
  const available = props.catalog.filter(entry => {
    if (!props.state.ownedIds.includes(entry.id) || occupied.includes(entry.id)) return false;
    if (target.kind === 'heart') return entry.kind === 'heart';
    if (target.kind === 'ability') return entry.kind === 'skill';
    const compatible = owner ? supportAssignable(entry, owner) : false;
    const duplicate = slot?.supports.some((id, socket) => {
      if (socket === target.socket) return false;
      const existing = props.catalog.find(support => support.id === id);
      return existing && existing.definitionId === entry.definitionId;
    });
    return entry.kind === 'support' && compatible && !duplicate;
  });
  const search = query.trim();
  const matching = available.filter(entry => entry.name.includes(search) && (filter === 'all' || entry.skillType === filter));
  const pages = Math.max(1, Math.ceil(matching.length / 4));
  const currentPage = Math.min(page, pages - 1);
  const visible = matching.slice(currentPage * 4, currentPage * 4 + 4);

  function searchFor(value: string): void { setQuery(value); setPage(0); }
  function filterBy(value: string): void { setFilter(value); setPage(0); }
  function toggleBag(): void { setBagOpen(!bagOpen); setQuery(''); setFilter('all'); setPage(0); }

  if (showingBag) return <section className={s.detailContent} aria-label={`选择${kindName}`}>
    <header className={s.inventoryHeading}><h2>选择{kindName}</h2>{item && <button type="button" className={s.textButton} disabled={!props.canEdit} onClick={toggleBag}>返回详情</button>}</header>
    {owner && target.kind === 'support' && <p className={s.context}>所属技能：{owner.name} · 仅显示可装配辅助</p>}
    <input className={s.search} aria-label="搜索可装备物品" placeholder={`搜索${kindName}`} value={query} onChange={event => searchFor(event.target.value)} />
    {target.kind === 'ability' && <div className={s.filters} role="group" aria-label="技能类型">{[{ id: 'all', name: '全部' }, { id: 'melee', name: '近战' }, { id: 'ranged', name: '远程' }].map(option => <button key={option.id} type="button" aria-pressed={filter === option.id} onClick={() => filterBy(option.id)}>{option.name}</button>)}</div>}
    <div className={s.inventory} aria-label="可装备物品列表">{visible.map(entry => {
      const kind = equipmentKindName(entry);
      const cost = displayNumber(entry.cost); const recovery = displayNumber(entry.recovery); const interval = displayNumber(entry.interval);
      const multiplier = displayNumber(entry.costMultiplier); const damage = displayNumber(entry.damageMultiplier);
      const stats = entry.kind === 'heart' ? `容量 ${entry.capacity} · 每${interval}秒恢复${recovery}` : entry.kind === 'skill' ? `基础耗能 ${cost} · 间隔 ${interval}秒` : `耗能 ×${multiplier} · 效果 ×${damage}`;
      return <button type="button" key={entry.id} className={s.inventoryItem} disabled={!props.canEdit} onClick={() => props.equip(entry)} aria-label={`装备${entry.name} Lv.${entry.level ?? 1}`}><SkillArt item={entry} /><span><b>{entry.name}<small>Lv.{entry.level ?? 1}</small></b><small>{kind}{entry.id.startsWith('starter:') ? ' · 免费保底' : ''}</small><small>{stats}</small></span><em>装配</em></button>;
    })}{!visible.length && <div className={s.empty}><strong>{search ? '没有匹配的物品' : '暂无可装备物品'}</strong><p>{target.kind === 'support' ? '已装配、同名或不兼容的辅助不在此列。' : '已装配物品需先拆下，才可用于其他槽位。'}</p></div>}</div>
    <nav className={s.pagination} aria-label="物品分页"><button type="button" aria-label="上一页物品" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>‹</button><span>{currentPage + 1} / {pages}</span><button type="button" aria-label="下一页物品" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>›</button></nav>
  </section>;

  if (!item) return null;
  const kind = equipmentKindName(item);
  const route = abilityGrowthRoute(item);
  const growth = abilityGrowthSummary(item);
  const description = equipmentDescription(item);
  const level = item.level ?? 1;
  const highlight = item.effect === 'fireball' && level >= 5 ? '命中爆炸 · 留下余火' : item.kind === 'heart' ? '所有连接技能共享灵力池' : item.kind === 'support' ? `仅修饰 ${owner?.name ?? '所属技能'}` : description.split(/[；。]/)[0];
  const speed = item.skillType === 'melee' ? props.attackSpeed : props.castingSpeed;
  const fallback: EquipmentLoadoutData = { heart: loadout.heart, slots: [slot ?? null] };
  const single = equipmentRuntime(fallback, manifest, props.state.items);
  const selectedBranch = branch ?? single.branches[0];
  const costMultiplier = heartCostMultiplier(heart);
  const displayedCost = displayNumber(item.cost * (selectedBranch?.costMultiplier ?? costMultiplier));
  const rawInterval = item.interval * (selectedBranch?.intervalMultiplier ?? 1) / speed;
  const interval = item.effect === 'star-beam' ? Math.max(1.2, rawInterval) : rawInterval;
  const intervalText = displayNumber(interval);
  const itemCapacity = heartCapacity(item, props.capacityBonus);
  const heartMultiplier = heartCostMultiplier(item);
  const multiplierText = displayNumber(heartMultiplier);
  const recoveryText = displayNumber(item.recovery); const recoveryInterval = displayNumber(item.interval);
  const supportCost = displayNumber(item.costMultiplier); const supportDamage = displayNumber(item.damageMultiplier);
  const equippedSupports = slot?.supports.filter(Boolean).length ?? 0;
  const supportCompatibleNow = item.kind === 'support' && owner ? supportCompatible(item, owner) : true;
  const requiredLevel = Math.max(activationSlotLevels[target.socket], supportCompatibleNow ? 1 : 5);
  const activation = target.kind === 'ability' || !heart || target.branch >= heart.slots ? `心法${activationSlotLevels[target.branch]}级激活` : `所属技能${requiredLevel}级激活`;
  return <section className={s.detailContent} aria-label="选中装备详情">
    <header className={s.itemHeading}><SkillArt item={item} /><div><h2>{item.name}</h2><span>Lv.{level} · {kind}</span>{item.id.startsWith('starter:') && <small>免费保底</small>}</div></header>
    <p className={s.highlight}>{highlight}</p>
    {!active && <p className={s.activation}>已预装 · {activation}</p>}
    <dl className={s.stats}>{item.kind === 'heart' ? <><div><dt>角色灵力上限</dt><dd>{itemCapacity}</dd></div><div><dt>恢复节奏</dt><dd>{recoveryInterval}秒 / {recoveryText}灵力</dd></div><div><dt>连接耗能倍率</dt><dd>×{multiplierText}</dd></div><div><dt>已激活技能槽</dt><dd>{item.slots}</dd></div></> : item.kind === 'support' ? <><div><dt>耗能倍率</dt><dd>×{supportCost}</dd></div><div><dt>伤害／增益倍率</dt><dd>×{supportDamage}</dd></div>{(item.projectiles ?? 1) > 1 && <div><dt>投射物数量</dt><dd>×{item.projectiles}</dd></div>}</> : <><div><dt>{item.effect === 'star-beam' ? '每脉冲耗能' : '最终耗能'}</dt><dd>{displayedCost} 灵力/次</dd></div><div><dt>执行间隔</dt><dd>{intervalText} 秒</dd></div><div><dt>技能范围</dt><dd>{item.range ?? 0} 米</dd></div></>}</dl>
    {item.kind === 'skill' && <section className={s.supportSection}><h3>所属辅助 <small>{equippedSupports}/{slot?.supports.length ?? 0}</small></h3><div className={s.supportList}>{slot?.supports.map((id, socket) => {
      const support = props.catalog.find(entry => entry.id === id);
      const compatible = support ? supportCompatible(support, item) : true;
      const enabled = active && socket < item.supportSlots && compatible;
      const target: SkillSelection = { kind: 'support', branch: props.selection.branch, socket };
      const required = Math.max(activationSlotLevels[socket], compatible ? 1 : 5);
      const status = !active ? '随所属技能激活' : enabled ? '' : `技能${required}级激活`;
      return <button key={socket} type="button" className={`${s.supportItem} ${enabled ? '' : s.dormant}`} disabled={!props.canEdit} aria-label={`${item.name}辅助槽${socket + 1} · ${support?.name ?? '添加辅助'}`} onClick={() => props.choose(target)}>{support ? <SkillArt item={support} /> : <span className={s.emptyGem}>+</span>}<span>{support ? `${support.name} Lv.${support.level ?? 1}` : '添加辅助'}{status && <small>{support ? '已预装 · ' : ''}{status}</small>}</span></button>;
    })}</div></section>}
    {item.kind === 'support' && <p className={s.context}>所属技能：{owner?.name}</p>}
    <details className={s.growth}><summary>成长路线与完整效果</summary><p>{description}</p><p>{growth}</p>{route.map(entry => <p key={entry}>{entry}</p>)}{item.kind === 'skill' && <BannerDetails branch={selectedBranch} magicalAttack={props.magicalAttack} />}</details>
    {item.kind === 'heart' && <div className={s.rhythm}><AttackRhythm runtime={runtime} attackSpeed={props.attackSpeed} castingSpeed={props.castingSpeed} /></div>}
    <div className={s.actions}><button className={s.primary} type="button" disabled={!props.canEdit} onClick={toggleBag}>替换{kindName}</button><button className={s.secondary} type="button" disabled={!props.canEdit} onClick={props.unequip}>拆卸</button></div>
  </section>;
}
