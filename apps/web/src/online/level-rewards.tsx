import { abilityDemand } from '@web-game-world/simulation';
import { displayNumber as number } from '../hud/display-number';
import type { BuildStateData, PlayerView } from '@web-game-world/contracts';
import { abilityUnlock, abilityGrowthSummary, trainBuildItem, supportProgress, trainingLabel, itemExperienceNeeded, buildCatalog, characterGrowthRewards, equipmentRuntime, equippedIds } from '@web-game-world/simulation';
import type { EquipmentItem } from '@web-game-world/simulation';
import { EquipmentIcon } from '../hud/equipment-icon';
import content from '../network/content';
import vitalityArt from './assets/vitality-reward.png';
import s from './level-rewards.module.css';

type Choice = BuildStateData['choices'][number];
type Option = Choice['options'][number];
interface RewardProps { state: BuildStateData; choice: Choice; player?: PlayerView; error: string; choose: (id: number, index: number) => void; close: () => void }
interface Preview { title: string; badge: string; level: string; headline: string; details: string[]; item?: EquipmentItem; slots?: { before: number; after: number; label: string }; fallback?: boolean }
function characterPreview(option: Option, state: BuildStateData): Preview {
  const requested = characterGrowthRewards.find(reward => reward.id === option.itemId);
  const rank = state.characterRanks[option.itemId] ?? 0;
  const fallback = !requested || rank >= requested.max;
  const reward = !requested || fallback ? characterGrowthRewards[0] : requested;
  const currentRank = state.characterRanks[reward.id] ?? 0;
  const details = [reward.percent ? '按入场属性累加，本局持续生效' : '作用于角色，本局持续生效'];
  if (reward.stat === 'maxHp') details.push('存活时同步增加当前生命；灵魂状态不会复活');
  if (reward.stat === 'attackSpeed' || reward.stat === 'castingSpeed') details.push('出手更快，也会提高每秒灵力需求');
  if (fallback) details.push('原目标已满级，替换为体魄强化');
  return { title: reward.name, badge: '本局属性强化', level: `已选 ${currentRank} 次 · 上限 ${reward.max} 次`, headline: reward.description, details, fallback };
}
function preview(option: Option, props: RewardProps): Preview {
  if (option.kind === 'character') return characterPreview(option, props.state);
  const catalog = buildCatalog(content, props.state.items);
  const item = catalog.find(entry => entry.id === option.itemId);
  if (!item || (item.level ?? 1) >= 20) {
    const substitute: Option = { kind: 'character', itemId: 'vitality', level: 1 };
    const result = characterPreview(substitute, props.state);
    result.details.push('原升级目标不可提升，改为体魄强化'); result.fallback = true; return result;
  }
  const upgraded = props.state.items.map(instance => { const copy = { ...instance }; if (copy.id === option.itemId) trainBuildItem(copy); return copy; });
  const nextCatalog = buildCatalog(content, upgraded); const next = nextCatalog.find(entry => entry.id === item.id) ?? item;
  if ((item.level ?? 1) >= 10 && next.level === item.level) return { item, title: item.name, badge: '局内修习经验', level: `Lv.${item.level} · 上限 20`, headline: trainingLabel(item), details: ['累计满后升级；换下保留进度，返回大厅不保留', `下一级需要 ${itemExperienceNeeded(item.level ?? 10)} 经验`] };
  const equipped = equippedIds(props.state.loadout); const active = equipped.includes(item.id);
  const details: string[] = [];
  let headline = '提升基础效果'; let slots: Preview['slots'];
  if (item.kind === 'heart') {
    headline = `每秒供能 ${number(item.recovery / item.interval)} → ${number(next.recovery / next.interval)}`;
    details.push(`灵力容量 ${number(item.capacity)} → ${number(next.capacity)}`);
    if (next.slots > item.slots) { slots = { before: item.slots, after: next.slots, label: '能力槽' }; headline = `能力槽 ${item.slots} → ${next.slots}`; details.push(`每秒供能 ${number(item.recovery / item.interval)} → ${number(next.recovery / next.interval)}`); }
  } else if (item.kind === 'weapon' || item.kind === 'skill') {
    const beforeDamage = (item.coefficient ?? 0) * 100; const afterDamage = (next.coefficient ?? 0) * 100;
    headline = `伤害系数 ${number(beforeDamage)}% → ${number(afterDamage)}%`;
    if (next.supportSlots > item.supportSlots) { slots = { before: item.supportSlots, after: next.supportSlots, label: '辅助槽' }; details.push(headline); headline = `辅助槽 ${item.supportSlots} → ${next.supportSlots}`; }

    details.push(`基础间隔 ${number(item.interval)}秒 · 基础消耗 ${number(item.cost)}灵力`);
  } else {
    const before = supportProgress(item.level ?? 1); const after = supportProgress(next.level ?? 1);
    headline = `伤害倍率 ${number(item.damageMultiplier)} → ${number(next.damageMultiplier)}`;
    if (item.effect === 'haste') headline = `间隔倍率 ${number(.9 - .15 * before)} → ${number(.9 - .15 * after)}`;
    if (item.effect === 'area') headline = `范围倍率 ${number(1.15 + .2 * before)} → ${number(1.15 + .2 * after)}`;
    if (item.effect === 'knockback') headline = `击退距离 ${number(.25 + .25 * before)} → ${number(.25 + .25 * after)}米`;
    if (item.effect === 'resonance') headline = `共鸣增幅 ${number(15 + 15 * before)}% → ${number(15 + 15 * after)}%`;
    details.push(`耗能倍率 ${number(item.costMultiplier)} → ${number(next.costMultiplier)}`);
    details.push('仅强化所属能力');
  }
  const unlock = abilityUnlock(next, next.level ?? 1); const growth = abilityGrowthSummary(next);
  if (unlock && next.level !== item.level) { details.unshift(headline); headline = `新增效果：${unlock}`; }
  else if (growth) details.push(growth);
  if (item.kind === 'support' && item.description) details.push(item.description);
  const runtime = equipmentRuntime(props.state.loadout, content, upgraded);
  let demand = 0;
  for (const branch of runtime.branches) {
    const speed = branch.item.kind === 'weapon' ? props.player?.stats?.attackSpeed ?? 1 : props.player?.stats?.castingSpeed ?? 1;
    demand += abilityDemand(branch, speed);
  }
  const heart = runtime.heartItem; const supply = heart ? heart.recovery / heart.interval : 0;
  if (active) details.push(`升级后基础供给 ${number(supply)}/秒 · 需求 ${number(demand)}/秒`);
  else details.push('当前未装备，强化保留在该物品上');
  return { item, title: item.name, badge: (item.level ?? 1) >= 10 ? '修习完成 · 提升1级' : '临时提升 1 级', level: `有效等级 ${item.level} → ${next.level}`, headline, details, slots };
}
export function LevelRewards(props: RewardProps) {
  function choose(index: number): void { props.choose(props.choice.id, index); }
  const earned = props.choice.earnedLevel ?? props.state.level;
  return <section className={s.panel} aria-labelledby="level-reward-title">
    <header className={s.header}><div className={s.kicker}>角色升级</div><button className={s.fold} onClick={props.close}>⌃ 收起，稍后选择</button><h2 id="level-reward-title">选择本次成长</h2><p>角色等级 {earned - 1} → {earned} <span>·</span> 待选奖励 {props.state.upgradeCredits} 次</p></header>
    <div className={s.cards}>{props.choice.options.map((option, index) => {
      const view = preview(option, props);
      const category = index === 0 ? option.kind === 'character' || view.fallback ? '角色成长' : '构筑成长' : index === 1 ? '角色成长' : '灵活成长';
      const slots = view.slots;
      const socketItems = slots ? Array.from({ length: slots.after }, (_, socket) => socket) : [];
      return <article className={s.card} key={`${props.choice.id}-${index}`}><span className={s.category}>{category}</span>
        <div className={s.art}>{view.item ? <EquipmentIcon kind={view.item.kind} effect={view.item.kind === 'weapon' ? undefined : view.item.effect} size={156} /> : <img src={vitalityArt} alt="" />}</div>
        <h3>{view.title}</h3><span className={s.badge}>{view.badge}</span><p className={s.level}>{view.level}</p><div className={s.divider} />
        <strong className={s.headline}>{view.headline}</strong>
        {slots && <div className={s.sockets} aria-label={`${slots.label}从${slots.before}个增加到${slots.after}个`}>{socketItems.map(socket => <span key={socket} data-new={socket >= slots.before}>{socket >= slots.before ? '新增' : `${socket + 1}`}</span>)}</div>}
        <ul className={s.details}>{view.details.map(detail => <li key={detail}>{detail}</li>)}</ul>
        <button className={s.select} onClick={() => choose(index)}>{`选择${view.title}`}</button>
      </article>;
    })}</div>
    {props.error && <p className={s.error} role="alert">{props.error}</p>}
    <footer className={s.footer}><b>三选一 · 仅本局生效 · 收起不会丢失奖励</b><p>多人战斗持续进行，收起后可继续移动</p></footer>
  </section>;
}
