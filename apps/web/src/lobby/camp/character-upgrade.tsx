import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import type { Profile, CharacterGrowthSaveData, CharacterUpgradeData } from '@web-game-world/contracts';
import { abilitySlotLevels, supportSlotLevels, characterSlots, characterUpgradePrice, characterAttributes, characterGrowthSpent, calculateCharacterStats, emptyCharacterGrowth, characterTalents } from '@web-game-world/simulation';
import type { CharacterPoints, CharacterAttribute, CharacterStats } from '@web-game-world/simulation';
import type { LobbyViewProps } from '../../online/lobby-view';
import { campPortrait } from './camp-assets';
import manifest from '../../network/content';
import { newRequestId } from '../../network/request-id';
import atlas from '../../../../../content/packs/forest-survival/assets/runtime/loot-symbols.png';
import s from './character-upgrade.module.css';
import { useTutorial } from '../../online/tutorial/tutorial-context';
import { TutorialCard, TutorialHint } from '../../online/tutorial/tutorial-ui';
import g from '../../online/tutorial/tutorial.module.css';

const attributes: { key: CharacterAttribute; name: string; benefit: string; cell: number }[] = [
  { key: 'power', name: '力量', benefit: '物攻 +2', cell: 8 },
  { key: 'magic', name: '魔力', benefit: '魔攻 +2', cell: 1 },
  { key: 'vitality', name: '体力', benefit: '生命 +10 · 物防 +1', cell: 0 },
  { key: 'spirit', name: '精神', benefit: '灵力容量 +5 · 魔防 +1', cell: 2 },
  { key: 'movement', name: '移动', benefit: '移速 +0.5%', cell: 13 },
  { key: 'haste', name: '攻速', benefit: '近战与远程速度 +1%', cell: 11 },
  { key: 'luck', name: '幸运', benefit: '幸运 +1', cell: 12 }
];
const statRows: { key: keyof CharacterStats; name: string; suffix?: string; digits?: number }[] = [
  { key: 'maxHp', name: '最大生命' },
  { key: 'physicalAttack', name: '物理攻击' },
  { key: 'magicalAttack', name: '魔法攻击' },
  { key: 'physicalDefense', name: '物理防御' },
  { key: 'magicalDefense', name: '魔法防御' },
  { key: 'energyCapacityBonus', name: '灵力容量加成' },
  { key: 'movementSpeed', name: '移动速度', suffix: ' 米/秒', digits: 3 },
  { key: 'attackSpeed', name: '近战速度', suffix: '×', digits: 2 },
  { key: 'castingSpeed', name: '远程速度', suffix: '×', digits: 2 },
  { key: 'luck', name: '幸运' }
];
const milestoneLevels = [...abilitySlotLevels, ...supportSlotLevels];
const uniqueLevels = new Set(milestoneLevels);
const milestones = [...uniqueLevels];
milestones.sort((left, right) => left - right);

function GrowthIcon(props: { cell: number }) {
  const x = props.cell % 4 * 100 / 3;
  const y = Math.floor(props.cell / 4) * 100 / 3;
  const style: CSSProperties = { backgroundImage: `url(${atlas})`, backgroundPosition: `${x}% ${y}%` };
  return <span className={s.icon} style={style} aria-hidden="true" />;
}

function initialStatsOpen(): boolean {
  const media = window.matchMedia('(min-width: 700px)');
  return media.matches;
}

interface CharacterUpgradeProps {
  profile: Profile;
  upgrade: LobbyViewProps['upgradeCharacter'];
  saveGrowth: LobbyViewProps['saveCharacterGrowth'];
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}

export function CharacterUpgrade(props: CharacterUpgradeProps) {
  const guide = useTutorial();
  const saved = props.profile.characterGrowth ?? emptyCharacterGrowth;
  const revision = props.profile.characterGrowthRevision ?? 0;
  const [draft, setDraft] = useState<CharacterPoints>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState<'upgrade' | 'save'>('save');
  const [statsOpen, setStatsOpen] = useState(initialStatsOpen);
  const working = useRef(false);
  const upgradeRequest = useRef<CharacterUpgradeData | null>(null);
  const saveRequest = useRef<CharacterGrowthSaveData | null>(null);
  const source = useRef({ id: props.profile.id, revision });
  const level = props.profile.characterLevel ?? 1;
  const total = level - 1;
  const spent = characterGrowthSpent(draft);
  const remaining = total - spent;
  const changed = characterAttributes.some(key => draft[key] !== saved[key]);
  const build = props.profile.character ?? { name: props.profile.name, description: '', points: manifest.character.points, talents: [] };
  const stats = calculateCharacterStats(build, draft);
  const savedStats = calculateCharacterStats(build, saved);
  const talents = characterTalents.filter(talent => build.talents.includes(talent.id));
  const slots = characterSlots(level);
  const next = characterSlots(level + 1);
  const price = characterUpgradePrice(level);
  const maxed = level >= 20;
  const nextMilestone = milestones.find(required => required > level);
  const followingMilestone = milestones.find(required => required > level + 1);
  const followingSlots = characterSlots(followingMilestone ?? level);
  const precedingSlots = characterSlots((followingMilestone ?? level) - 1);
  const followingAbility = followingMilestone !== undefined && abilitySlotLevels.includes(followingMilestone);
  const canUpgrade = !busy && !maxed && Boolean(props.upgrade) && props.profile.coins >= price;
  const learning = guide.active && guide.phase === 'growth';
  const allocating = level > 1 && total > 0;
  const guideTitle = allocating ? '分配成长点，并保存' : '用金币提升角色等级';
  const guideText = allocating ? '选择属性旁的加号，自由分配成长点。点击保存分配后，属性成长才会保存。' : props.profile.coins >= price ? `首次冒险已结算。升级消耗 ${price} 金币，获得 1 个成长点；槽位按界面中的等级条件解锁。` : `本次升级需要 ${price} 金币，当前还差 ${price - props.profile.coins} 金币。可以继续探索秘境，稍后成长。`;
  useEffect(() => { if (learning) guide.mark('growth-viewed'); }, [learning, guide.mark]);
  function deferGrowth(): void { void guide.act('collapse'); }

  useEffect(() => {
    const media = window.matchMedia('(min-width: 700px)');
    function resizeStats(): void { setStatsOpen(media.matches); }
    media.addEventListener('change', resizeStats);
    return () => { media.removeEventListener('change', resizeStats); };
  }, []);

  useEffect(() => {
    if (!notice) return;
    function clearNotice(): void { setNotice(''); }
    const timer = window.setTimeout(clearNotice, 2400);
    return () => { window.clearTimeout(timer); };
  }, [notice]);

  function toggleStats(event: SyntheticEvent<HTMLDetailsElement>): void { setStatsOpen(event.currentTarget.open); }

  useEffect(() => {
    const current = props.profile;
    const currentRevision = current.characterGrowthRevision ?? 0;
    if (source.current.id === current.id && source.current.revision === currentRevision) return;
    source.current = { id: current.id, revision: currentRevision };
    const points = current.characterGrowth ?? emptyCharacterGrowth;
    setDraft(points);
    saveRequest.current = null;
  }, [props.profile]);

  function adjust(key: CharacterAttribute, amount: number): void {
    if (working.current) return;
    setDraft(current => {
      const used = characterGrowthSpent(current);
      const value = current[key] + amount;
      if (value < 0 || value > 19 || amount > 0 && used >= total) return current;
      return { ...current, [key]: value };
    });
    setError(''); setNotice('');
  }

  function reset(): void {
    if (working.current) return;
    const points = { ...emptyCharacterGrowth };
    setDraft(points); setError(''); setNotice('');
  }

  async function upgrade(): Promise<void> {
    if (working.current || !canUpgrade || !props.upgrade) return;
    working.current = true; setBusy(true); props.onBusyChange(true); setError(''); setNotice(''); setAction('upgrade');
    try {
      if (!upgradeRequest.current || upgradeRequest.current.level !== level) {
        const requestId = newRequestId();
        upgradeRequest.current = { requestId, level };
      }
      await props.upgrade(upgradeRequest.current);
      upgradeRequest.current = null;
      setNotice('升级成功，成长点 +1');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '升级失败，请重试';
      setError(message);
    } finally {
      working.current = false; setBusy(false); props.onBusyChange(false);
    }
  }

  async function save(): Promise<void> {
    if (working.current || !changed || !props.saveGrowth) return;
    working.current = true; setBusy(true); props.onBusyChange(true); setError(''); setNotice(''); setAction('save');
    try {
      const previous = saveRequest.current;
      const samePoints = previous && characterAttributes.every(key => previous.points[key] === draft[key]);
      if (!previous || previous.revision !== revision || !samePoints) {
        const requestId = newRequestId();
        saveRequest.current = { requestId, revision, points: { ...draft } };
      }
      const data = saveRequest.current;
      if (!data) return;
      await props.saveGrowth(data);
      saveRequest.current = null;
      setNotice('分配已保存');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '保存失败，请重试';
      setError(message);
    } finally {
      working.current = false; setBusy(false); props.onBusyChange(false);
    }
  }

  return <section className={s.growth} aria-label="永久角色成长" aria-busy={busy}>
    <header className={s.heading}><h1 id="camp-panel-title">角色成长</h1><div className={s.wallet}><span className={s.coin} aria-hidden="true" /><strong aria-label="金币余额">{props.profile.coins}</strong></div><button className={s.close} type="button" onClick={props.onClose} disabled={busy} aria-label="关闭角色成长">×</button></header>
    <div className={s.scrollBody}>
    {learning && <TutorialCard title={guideTitle} text={guideText} step={5} action="稍后成长" onAction={deferGrowth} />}
    <div className={s.columns}>
      <section className={s.identity}>
        <div className={s.character}><img className={s.portrait} src={campPortrait} alt="" /><div><h2>{build.name}</h2><span>永久等级</span><strong>Lv.{level}</strong></div></div>
        <details className={s.statsDetail} open={statsOpen} onToggle={toggleStats}>
        <summary><h3>战斗属性</h3><span className={s.previewLabel}>{changed ? '加点预览' : '当前属性'}</span></summary>
        <dl className={s.stats}>{statRows.map(row => {
          const value = stats[row.key];
          const original = savedStats[row.key];
          const formatted = value.toFixed(row.digits ?? 0);
          const originalText = original.toFixed(row.digits ?? 0);
          const different = Math.abs(value - original) > 0.00001;
          return <div key={row.key}><dt>{row.name}</dt><dd>{different && <><del>{originalText}</del><span className={s.previewValue} aria-hidden="true">→</span></>}<span className={different ? s.previewValue : undefined}>{formatted}</span>{row.suffix && <small>{row.suffix}</small>}</dd></div>;
        })}</dl>
        {talents.length > 0 && <div className={s.talents}>{talents.map(talent => <span key={talent.id} title={talent.detail}>{talent.name}</span>)}</div>}
        </details>
        <dl className={s.capacity}><div><dt>可配置技能</dt><dd>{slots.abilities}</dd></div><div><dt>每技能辅助格</dt><dd>{slots.supports}</dd></div></dl>
      </section>
      <section className={`${s.allocation} ${learning && guide.expanded && allocating && !changed ? g.target : ''}`}>
        <header className={s.sectionHeader}><h3>属性分配</h3><span className={s.points}>可用成长点 <strong>{remaining}</strong></span></header>
        <TutorialHint show={learning && allocating} title="选择需要的属性，再保存">本次分配属于永久角色成长；免费重置可以重新调整。</TutorialHint>
        <div className={s.tableHeader}><span>属性 · 每点收益</span><span>初始</span><span>成长</span><span>合计</span><span /></div>
        <div>{attributes.map(attribute => {
          const key = attribute.key;
          const value = draft[key];
          const sum = build.points[key] + value;
          function decrease(): void { adjust(key, -1); }
          function increase(): void { adjust(key, 1); }
          return <div className={s.attributeRow} key={key}>
            <div className={s.attributeName}><GrowthIcon cell={attribute.cell} /><div><b>{attribute.name}</b><small>{attribute.benefit}</small></div></div>
            <span>{build.points[key]}</span><span className={`${s.growthValue} ${value !== saved[key] ? s.previewValue : ''}`}>+{value}</span><strong>{sum}</strong>
            <div className={s.adjust}><button type="button" aria-label={`减少${attribute.name}`} disabled={busy || value === 0} onClick={decrease}>−</button><button type="button" aria-label={`增加${attribute.name}`} disabled={busy || remaining <= 0 || value >= 19} onClick={increase}>+</button></div>
          </div>;
        })}</div>
        <div className={s.allocationFooter}>
          <span>已分配 <b>{spent} / {total}</b>{changed && <em>未保存</em>}</span>
          <div>
            <button type="button" className={s.reset} disabled={busy || spent === 0} onClick={reset}>免费重置</button>
            <button type="button" className={`${s.primary} ${s.save} ${learning && guide.expanded && changed && !busy ? g.target : ''}`} disabled={busy || !changed || !props.saveGrowth} onClick={save}>{busy && action === 'save' ? '正在保存…' : '保存分配'}</button>
          </div>
        </div>
      </section>
      <section className={s.upgrade} aria-label="金币升级">
        <div className={s.upgradeGain}>
          <h3>Lv.{level}{!maxed && <><span>→</span>Lv.{level + 1}</>}</h3>
          {maxed ? <p>永久等级已达上限</p> : <p>成长点 <b>+1</b>{next.abilities > slots.abilities && <span>技能槽 <b>{slots.abilities} → {next.abilities}</b></span>}{next.supports > slots.supports && <span>每技能辅助格 <b>{slots.supports} → {next.supports}</b></span>}</p>}
        </div>
        <div className={s.purchase}>
          {maxed ? <span className={s.maxed}>已满级</span> : <>
            <button type="button" className={`${s.primary} ${learning && guide.expanded && !allocating && canUpgrade ? g.target : ''}`} disabled={!canUpgrade} onClick={upgrade} aria-label={`升级至 Lv.${level + 1}，消耗 ${price} 金币`}>{busy && action === 'upgrade' ? '正在升级…' : <>升级 · <span className={s.coin} aria-hidden="true" />{price}</>}</button>
            <small className={props.profile.coins < price ? s.insufficient : undefined}>{props.profile.coins >= price ? <>升级后余额 <b>{props.profile.coins - price}</b></> : <>金币不足 · 还差 <b>{price - props.profile.coins}</b></>}</small>
          </>}
        </div>
      </section>
    </div>
    <details className={s.milestones} aria-label="成长里程碑"><summary><span>{followingMilestone ? <>后续解锁 <b>Lv.{followingMilestone}</b> · {followingAbility ? '技能槽' : '每技能辅助格'} <b>{followingAbility ? precedingSlots.abilities : precedingSlots.supports} → {followingAbility ? followingSlots.abilities : followingSlots.supports}</b></> : maxed ? '全部槽位已解锁' : '成长里程碑'}</span><span className={s.more}>全部里程碑 <i aria-hidden="true">⌄</i></span></summary><ol>{milestones.map(required => {
      const capacity = characterSlots(required);
      const ability = abilitySlotLevels.includes(required);
      const label = required === 1 ? '初始构筑' : ability ? `技能 ×${capacity.abilities}` : `辅助 ×${capacity.supports}`;
      const state = required <= level ? s.complete : required === nextMilestone ? s.upcoming : '';
      return <li key={required} className={state} aria-current={required === nextMilestone ? 'step' : undefined}><span>Lv.{required}</span><small>{label}</small></li>;
    })}</ol></details>
    </div>
    <div className={s.feedback} aria-live="polite">{(error || notice) && <p className={error ? s.error : undefined} role={error ? 'alert' : 'status'}>{error || notice}</p>}</div>
  </section>;
}
