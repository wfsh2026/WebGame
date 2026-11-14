import { useEffect, useState } from 'react';
import { TalentIcon } from './talent-icon';
import portraitUrl from './assets/adventurer.webp';
import { characterTalents, characterBudget, calculateCharacterStats, defaultCharacterPoints, startingLoadoutAllowsShallow } from '@web-game-world/simulation';
import type { CharacterBuild, CharacterPoints, CharacterTalent } from '@web-game-world/simulation';
import s from './creator.module.css';
import { appVersion } from '../app-version';

type Attribute = 'power' | 'magic' | 'vitality' | 'spirit' | 'movement' | 'haste' | 'luck';
type Points = CharacterPoints;
type Talent = CharacterTalent;
const attributes: { id: Attribute; name: string; hint: string; icon: string }[] = [
  { id: 'power', name: '力量', hint: '物理攻击 +2', icon: '力' },
  { id: 'magic', name: '魔力', hint: '魔法攻击 +2', icon: '法' },
  { id: 'vitality', name: '体力', hint: '生命 +10 · 物防 +1', icon: '体' },
  { id: 'spirit', name: '精神', hint: '灵力上限 +5 · 魔防 +1', icon: '灵' },
  { id: 'movement', name: '移动', hint: '移动速度 +0.015 m/s', icon: '行' },
  { id: 'haste', name: '攻速', hint: '攻击 / 施法倍率各 +0.01', icon: '速' },
  { id: 'luck', name: '幸运', hint: '影响指定概率事件', icon: '运' }
];
const talents = characterTalents;
const startingPoints: Points = { power: 7, magic: 0, vitality: 3, spirit: 2, movement: 1, haste: 3, luck: 1 };
const purePoints: Points = defaultCharacterPoints;
const magePoints: Points = { power: 0, magic: 7, vitality: 3, spirit: 3, movement: 1, haste: 2, luck: 1 };

interface CreatorProps { onCreate?: (build: CharacterBuild) => Promise<void>; onExit?: () => void }
const statLabels = [
  { key: 'maxHp', label: '生命', digits: 0, icon: '♥' }, { key: 'energyCapacityBonus', label: '灵力容量加成', digits: 0, icon: '◆' },
  { key: 'physicalAttack', label: '物攻', digits: 0, icon: '⚔' }, { key: 'magicalAttack', label: '魔攻', digits: 0, icon: '✧' },
  { key: 'physicalDefense', label: '物防', digits: 0, icon: '⬡' }, { key: 'magicalDefense', label: '魔防', digits: 0, icon: '⬡' },
  { key: 'movementSpeed', label: '移速', digits: 3, icon: '➶' }, { key: 'attackSpeed', label: '攻速', digits: 2, icon: '⚡' },
  { key: 'castingSpeed', label: '施法', digits: 2, icon: '✦' }, { key: 'luck', label: '幸运', digits: 0, icon: '❀' }
] satisfies { key: keyof ReturnType<typeof calculateCharacterStats>; label: string; digits: number; icon: string }[];

export function CharacterCreator({ onCreate, onExit }: CreatorProps) {
  const [points, setPoints] = useState<Points>(startingPoints);
  const [selected, setSelected] = useState<string[]>(['brute', 'weapon', 'frail']);
  const [name, setName] = useState('断锋');
  const [description, setDescription] = useState('以生命为锋，换取更凌厉的近战技能攻势。');
  const [filter, setFilter] = useState('all');
  const [direction, setDirection] = useState('fighter');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [closePrompt, setClosePrompt] = useState(false);
  const [completed, setCompleted] = useState(false);
  const eligible = startingLoadoutAllowsShallow;
  const build: CharacterBuild = { name, description, points, talents: selected };
  const budget = characterBudget(build, eligible);
  const { spent, cost, refund, remaining, valid } = budget;
  const result = calculateCharacterStats(build);
  const baseBuild = { points, talents: [] };
  const base = calculateCharacterStats(baseBuild);
  const has = (id: string) => selected.includes(id);
  const chosen = talents.filter(talent => has(talent.id));
  const visible = talents.filter(talent => filter === 'all' || (filter === 'positive' ? talent.cost > 0 : talent.cost < 0));
  const status = budget.errors[0] ?? '预算分配完成';
  const title = onCreate ? '创建角色' : '角色工坊';

  useEffect(() => {
    function keyboard(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || saving) return;
      if (completed) setCompleted(false);
      else setClosePrompt(!closePrompt);
    }
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [saving, completed, closePrompt]);

  function adjust(id: Attribute, amount: number): void {
    if (saving) return;
    const value = points[id] + amount;
    if (value < 0 || value > 24 || (amount > 0 && remaining <= 0)) return;
    const next = { ...points, [id]: value };
    setPoints(next); setDirection('custom'); setNotice('');
  }
  function toggle(talent: Talent): void {
    if (saving || (talent.id === 'shallow' && !eligible)) return;
    const active = has(talent.id);
    const opposite = talents.find(item => item.id === talent.opposite && has(item.id));
    const next = active ? selected.filter(id => id !== talent.id) : selected.filter(id => id !== talent.opposite);
    if (!active) next.push(talent.id);
    setSelected(next); setDirection('custom');
    setNotice(opposite && !active ? `已替换互斥天赋「${opposite.name}」` : '');
  }
  function preset(kind: string): void {
    if (saving) return;
    if (kind === 'pure') { setPoints(purePoints); setSelected([]); setName('逐风者'); setDescription('没有额外天赋，将全部预算投入基础属性。'); }
    else if (kind === 'mage') { const list = ['arcane', 'casting', 'frail']; setPoints(magePoints); setSelected(list); setName('烬语'); setDescription('牺牲生命储备，专注远程技能威力与远程速度。'); }
    else { const list = ['brute', 'weapon', 'frail']; setPoints(startingPoints); setSelected(list); setName('断锋'); setDescription('以生命为锋，换取更凌厉的近战技能攻势。'); }
    setDirection(kind); setNotice('');
  }
  function reset(): void { preset('fighter'); setFilter('all'); setNotice('已恢复初始设计'); }
  async function create(): Promise<void> {
    if (!valid || saving) return;
    if (!onCreate) { setCompleted(true); return; }
    setSaving(true); setNotice('');
    try { await onCreate(build); }
    catch (cause) { const detail = cause instanceof Error ? cause.message : '创建失败，请稍后重试'; setNotice(detail); }
    finally { setSaving(false); }
  }
  function exportDraft(): void {
    if (!valid) return;
    const draft = { kind: 'character-design-draft', version: 1, character: build, budget: { base: 20, spent, cost, refund, remaining } };
    const json = JSON.stringify(draft, null, 2); const parts = [json]; const options = { type: 'application/json;charset=utf-8' }; const blob = new Blob(parts, options);
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'character-draft.json'; anchor.click();
    const release = () => URL.revokeObjectURL(url); window.setTimeout(release, 1000);
    setNotice('角色草稿已导出');
  }
  function exit(): void {
    setClosePrompt(false);
    if (onExit) { onExit(); return; }
    const target = new URL('./online.html', window.location.href); window.location.assign(target.href);
  }
  const renderAttribute = (attribute: typeof attributes[number]) => <div className={s.attribute} key={attribute.id}>
    <span className={s.attrIcon} aria-hidden="true">{attribute.icon}</span><label className={s.attrText} htmlFor={`points-${attribute.id}`}>{attribute.name}<small>{attribute.hint}</small></label>
    <div className={s.stepper}><button type="button" aria-label={`减少${attribute.name}`} disabled={points[attribute.id] === 0} onClick={() => adjust(attribute.id, -1)}>−</button><output id={`points-${attribute.id}`} data-testid={`points-${attribute.id}`}>{points[attribute.id]}</output><button type="button" aria-label={`增加${attribute.name}`} disabled={remaining <= 0 || points[attribute.id] >= 24} onClick={() => adjust(attribute.id, 1)}>+</button></div>
  </div>;
  const attributeRows = attributes.map(renderAttribute);
  const renderTalent = (talent: Talent) => {
    const active = has(talent.id); const weakness = talent.cost < 0; const locked = talent.id === 'shallow' && !eligible;
    const className = `${s.talent} ${active ? s.selected : ''} ${weakness ? s.weakness : ''}`;
    const price = weakness ? `返还 ${-talent.cost}` : `消耗 ${talent.cost}`;
    const descriptionText = locked ? '当前起始构筑无法体现该弱点的实际代价，暂不可选' : talent.detail;
    return <button type="button" key={talent.id} data-testid={`talent-${talent.id}`} className={className} aria-pressed={active} disabled={locked} title={descriptionText} onClick={() => toggle(talent)}>
      <span className={s.talentIcon}><TalentIcon name={talent.id}/></span><span className={s.talentBody}><span className={s.talentName}>{talent.name}</span><span className={s.effect}>{talent.effect}</span><small>{descriptionText}</small></span><span className={s.price}>{locked ? '暂未开放' : price}</span>{active && <span className={s.check} aria-label="已选择">✓</span>}{locked && <span className={s.lock} aria-label="已锁定">▣</span>}
    </button>;
  };
  const talentCards = visible.map(renderTalent);
  const renderStat = (stat: typeof statLabels[number]) => {
    const value = result[stat.key].toFixed(stat.digits); const initial = base[stat.key].toFixed(stat.digits); const difference = result[stat.key] - base[stat.key]; const delta = difference.toFixed(stat.digits);
    const detail = `基础 ${initial} · 天赋 ${difference >= 0 ? '+' : ''}${delta}`;
    return <div className={s.stat} key={stat.key} title={detail}><span className={s.statIcon} aria-hidden="true">{stat.icon}</span><span>{stat.label}</span><output data-testid={`stat-${stat.key}`}>{value}</output></div>;
  };
  const statRows = statLabels.map(renderStat);
  const filters = [{ id: 'all', name: '全部', count: 10 }, { id: 'positive', name: '增益', count: 7 }, { id: 'negative', name: '弱点', count: 3 }];
  const renderFilter = (item: typeof filters[number]) => <button type="button" key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? s.activeFilter : ''} onClick={() => setFilter(item.id)}>{item.name}<small>{item.count}</small></button>;
  const filterButtons = filters.map(renderFilter);
  const presets = [{ id: 'fighter', name: '近战专精' }, { id: 'mage', name: '远程专精' }, { id: 'pure', name: '纯粹属性' }];
  const renderPreset = (item: typeof presets[number]) => <button type="button" key={item.id} aria-pressed={direction === item.id} className={direction === item.id ? s.activePreset : ''} onClick={() => preset(item.id)}>{item.name}</button>;
  const presetButtons = presets.map(renderPreset);
  const modalOpen = closePrompt || completed;
  return <div className={s.page}>
    <main className={s.workshop} aria-label="角色创建工坊" inert={modalOpen}>
      <header className={s.header}><span className={s.banner} aria-hidden="true">✧</span><div className={s.title}><h1 aria-label="创建角色">创建角色</h1><p>分配属性，选择天赋，定义你的冒险者</p></div><span className={`${s.banner} ${s.rightBanner}`} aria-hidden="true">✧</span><button type="button" className={s.close} aria-label="关闭角色创建" disabled={saving} onClick={() => setClosePrompt(true)}>×</button></header>
      <fieldset className={s.editor} disabled={saving}>
        <div className={s.layout}>
          <section className={`${s.panel} ${s.identity}`} aria-labelledby="identity-heading"><h2 id="identity-heading" className={s.plaque}>角色档案</h2><div className={s.portrait}><img src={portraitUrl} alt="绿披风与羽帽的冒险者立绘"/><span className={s.portraitCaption}>新的旅程，由此开始</span></div><div className={s.identityFields}><label className={s.nameField}><span className={s.avatar}><img src={portraitUrl} alt=""/></span><span className={s.srOnly}>角色名称</span><input aria-label="角色名称" value={name} maxLength={20} onChange={event => { const value = event.target.value; setName(value); setNotice(''); }}/><span className={s.editIcon} aria-hidden="true">✎</span></label><label className={s.descriptionField}><span className={s.srOnly}>角色描述</span><textarea aria-label="角色描述" value={description} maxLength={120} onChange={event => { const value = event.target.value; setDescription(value); }}/></label><div className={s.templates} aria-label="角色预设">{presetButtons}</div></div></section>
          <section className={`${s.panel} ${s.attributes}`} aria-labelledby="attributes-heading"><h2 id="attributes-heading" className={s.plaque}>基础属性</h2><div className={s.attributeList}>{attributeRows}</div><div className={s.invested}>◇ 已投入 <b>{spent}</b> 点 ◇</div><section className={s.finalStats} aria-label="最终属性"><h3 className={s.plaque}>最终属性</h3><div className={s.statsGrid}>{statRows}</div><small className={s.statsHint}>悬停属性可查看基础值与天赋收益</small></section></section>
          <section className={`${s.panel} ${s.talents}`} aria-labelledby="talents-heading"><h2 id="talents-heading" className={s.plaque}>天赋与代价</h2><span className={s.selectedCount}>已选 {selected.length} 项</span><div className={s.filters} aria-label="天赋分类">{filterButtons}</div><div className={s.talentGrid}>{talentCards}</div><div className={s.poolNote}>◇ 天赋自由组合 · 弱点最多返还 4 点<span>加速不增加心法供给；浅池因当前构筑限制暂未开放。</span></div></section>
        </div>
        <footer className={s.budgetBar}><div className={s.ledger} aria-label="预算明细"><span>初始预算 <b>20</b></span><span>属性投入 <b data-testid="budget-spent">{spent}</b></span><span>天赋消耗 <b data-testid="budget-cost">{cost}</b></span><span>弱点返还 <b data-testid="budget-refund">{refund}</b></span></div><div className={`${s.remaining} ${remaining < 0 ? s.overBudget : ''}`}>剩余 <output data-testid="budget-remaining">{remaining}</output> 点</div><div className={s.feedback} role="status" aria-live="polite"><span className={valid ? s.valid : s.invalid}>{valid ? '✓' : '!'}</span><span>{notice || status}</span></div><div className={s.actions}><button type="button" className={s.reset} onClick={reset}>重置</button><button type="button" className={s.create} aria-label={saving ? '正在创建' : '创建角色'} disabled={!valid || saving} onClick={create}>{saving ? '正在创建…' : '创建角色'}<span aria-hidden="true">◇</span></button></div></footer>
      </fieldset><div className={s.bottomNote}>◇　基础规则固定，天赋自由组合　◇<small>{onCreate ? '创建后绑定当前账号' : '工坊预览 · 创建后可导出角色草稿，不写入游戏账号'} · v{appVersion}</small></div>
    </main>
    {modalOpen && <div className={s.modalBackdrop}><section className={s.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">{completed ? '角色方案已完成' : '离开角色工坊？'}</h2><p>{completed ? `「${name}」已完成预算分配。可导出草稿，或继续调整角色。` : '当前未提交的调整不会保存。你可以继续编辑，或确认离开。'}</p><div className={s.modalActions}><button type="button" className={s.reset} autoFocus onClick={() => { setClosePrompt(false); setCompleted(false); }}>继续编辑</button><button type="button" className={s.create} onClick={completed ? exportDraft : exit}>{completed ? '导出角色草稿' : onExit ? '退出账号' : '返回游戏入口'}</button></div>{completed && notice && <p role="status">{notice}</p>}</section></div>}
  </div>;
}


