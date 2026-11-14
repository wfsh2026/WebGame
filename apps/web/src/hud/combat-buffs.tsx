import { useEffect, useId, useState } from 'react';
import type { BattleRuntime } from '../game/battle-runtime';
import type { CSSProperties } from 'react';
import type { AbilityView, PlayerView } from '@web-game-world/contracts';
import { bannerKinds, bannerNames } from '@web-game-world/simulation';
import type { equipmentRuntime } from '@web-game-world/simulation';
import atlas from '../../../../content/packs/forest-survival/assets/runtime/hud-buffs.webp';
import { displayNumber } from './display-number';
import s from './combat-hud.module.css';

const cells = { counter: 18, haste: 1, focus: 2, shield: 3, 'banner-power': 4, 'banner-tempo': 5, 'banner-wind': 6, 'banner-energy': 7, 'banner-guard': 8, 'resonance-melee': 9, 'resonance-ranged': 10, 'cycle-energy': 11, 'heart-stream': 12, 'heart-spring': 13, 'heart-ocean': 14, 'cycle-recovery': 15, 'attack-haste': 16, economy: 17, overload: 18, staff: 19 };
type BuffIcon = keyof typeof cells;
type Equipment = ReturnType<typeof equipmentRuntime>;
type BannerBuff = NonNullable<PlayerView['banners']>['buffs'][number];
interface Buff { id: string; icon: BuffIcon; name: string; description: string; remaining?: number; count?: number; inside?: boolean }
interface BuffBarProps { runtime?: BattleRuntime; counterLeft?: number; player: PlayerView; abilities: AbilityView[]; equipment?: Equipment }

function percent(value: number, maximum = Infinity): string {
  const bounded = Math.min(value, maximum);
  const rounded = Math.round(bounded * 1000) / 10;
  return `${rounded}%`;
}

function bannerDescription(player: PlayerView, buff: BannerBuff): string {
  const fade = buff.inside ? 1 : buff.lingerFactor * (buff.remaining < .5 ? buff.remaining / .5 : 1);
  const strength = buff.strength * fade;
  if (buff.kind === 'banner-power') {
    const bonus = percent(strength * .12, .6);
    const next = percent(strength * .12 + buff.charge, .6);
    return buff.charge > 0 ? `技能直伤 +${bonus} · 下次 +${next}` : `技能直伤 +${bonus}`;
  }
  if (buff.kind === 'banner-tempo') { const bonus = percent(strength * .1, .35); return `攻击间隔 -${bonus}`; }
  if (buff.kind === 'banner-wind') { const bonus = percent(strength * .2, .6); return `弹速 / 近战出手速度 +${bonus}`; }
  if (buff.kind === 'banner-energy') {
    const bonus = percent(strength * .15 + buff.charge, .6);
    const budget = displayNumber(player.banners?.selfBudget ?? 0);
    return buff.owner === player.id ? `回灵量 +${bonus} · 自身返灵余量 ${budget}` : `回灵量 +${bonus}`;
  }
  const phase = buff.level >= 15 && buff.resist > 0 ? buff.level >= 20 ? 1.5 : 1.25 : 1;
  const bonus = percent(strength * .08 * phase, .35);
  const shield = Math.ceil(buff.shield);
  return shield > 0 ? `受到伤害 -${bonus} · 护盾 ${shield}` : `受到伤害 -${bonus}`;
}

function collectBuffs({ player, abilities, equipment, counterLeft }: BuffBarProps): Buff[] {
  if (player.hp <= 0) return [];
  const buffs: Buff[] = [];
  const counter = counterLeft ?? player.guard?.counterLeft ?? 0;
  if (counter > 0) buffs.push({ id: 'counter', icon: 'counter', name: '反击', description: '精防成功：本人造成的所有技能伤害 ×2；再次精防刷新至10秒，不叠加倍率。', remaining: counter });
  if ((player.hasteLeft ?? 0) > 0) buffs.push({ id: 'haste', icon: 'haste', name: '疾行', description: '移动速度 +15%', remaining: player.hasteLeft });
  if ((player.focusLeft ?? 0) > 0) buffs.push({ id: 'focus', icon: 'focus', name: '聚灵', description: '技能耗能 -20%', remaining: player.focusLeft });
  if ((player.lootShield ?? 0) > 0 && (player.shieldLeft ?? 0) > 0) {
    const shield = Math.ceil(player.lootShield ?? 0);
    buffs.push({ id: 'shield', icon: 'shield', name: '护盾', description: `吸收 ${shield} 伤害`, remaining: player.shieldLeft });
  }
  for (const buff of player.banners?.buffs ?? []) {
    if (buff.remaining <= 0 || buff.strength <= 0) continue;
    const kind = buff.kind;
    if (kind !== 'banner-power' && kind !== 'banner-tempo' && kind !== 'banner-wind' && kind !== 'banner-energy' && kind !== 'banner-guard') continue;
    const index = bannerKinds.indexOf(kind); const name = bannerNames[index];
    const description = bannerDescription(player, buff);
    buffs.push({ id: kind, icon: kind, name, description, remaining: buff.inside ? undefined : buff.remaining, inside: buff.inside });
  }
  const resonance = player.resonance;
  const resonanceSource = equipment?.branches.find(branch => branch.item.id === resonance?.buffSource && branch.resonance > 0);
  if (resonance && resonance.buffLeft > 0 && resonanceSource) {
    const melee = resonance.buffKind === 'melee';
    const power = resonance.buffPower * (resonance.finisher ? 1.5 : 1);
    const bonus = percent(power);
    const discount = resonance.finisher && (resonance.supportLevel ?? 0) >= 20 ? ' · 耗能 -20%' : '';
    const name = `${melee ? '近战' : '远程'}${resonance.finisher ? '终结共鸣' : '共鸣'}`;
    buffs.push({ id: 'resonance', icon: melee ? 'resonance-melee' : 'resonance-ranged', name, description: `下次${melee ? '近战' : '远程'}伤害 +${bonus}${discount}`, remaining: resonance.buffLeft });
  }
  const heart = equipment?.heartItem;
  if (heart?.effect === 'cycle') {
    if ((resonance?.energyBoost ?? 0) > 0) {
      const amount = displayNumber(resonance?.energyBoost ?? 0);
      buffs.push({ id: 'cycle-energy', icon: 'cycle-energy', name: '周天回灵', description: `下次回灵额外 +${amount}` });
    }
    if ((resonance?.recoveryCharges ?? 0) > 0) {
      const bonus = (heart.level ?? 1) >= 20 ? 30 : 15;
      buffs.push({ id: 'cycle-recovery', icon: 'cycle-recovery', name: '周天强化', description: `基础回灵量 +${bonus}%`, count: resonance?.recoveryCharges });
    }
  } else if (heart && (player.heartProgress?.burst ?? 0) > 0) {
    const id = heart.definitionId ?? heart.id; const mastery = (heart.level ?? 1) >= 20;
    const spring = id.endsWith('/spring'); const ocean = id.endsWith('/ocean');
    const bonus = spring ? mastery ? 35 : 20 : ocean ? mastery ? 80 : 50 : mastery ? 40 : 20;
    const description = spring ? `回灵间隔 -${bonus}%` : `回灵量 +${bonus}%`;
    buffs.push({ id: 'heart-burst', icon: spring ? 'heart-spring' : ocean ? 'heart-ocean' : 'heart-stream', name: `${heart.name}强化`, description, remaining: player.heartProgress?.burst });
  }
  for (const ability of abilities) {
    const progress = ability.progress;
    const branch = equipment?.branches.find(entry => entry.item.id === ability.id);
    if (!progress || !branch) continue;
    const levels = branch.supportLevels;
    if ((levels.haste ?? 0) >= 3 && progress.stacks > 0) {
      const bonus = percent(progress.stacks * .04); const count = Math.ceil(progress.stacks);
      const rapid = (levels.haste ?? 0) >= 20 && progress.stacks >= 5 && (ability.triggers - progress.origin + 1) % 5 === 0;
      const description = rapid ? `执行频率 +${bonus} · 下次间隔减半` : `执行频率 +${bonus}`;
      buffs.push({ id: `${ability.id}-haste`, icon: 'attack-haste', name: `${ability.name} · 迅捷`, description, count });
    }
    const starved = (levels.economy ?? 0) >= 3 && progress.starved >= .5;
    const charges = (levels.economy ?? 0) >= 5 ? progress.charges : 0;
    if (starved || charges > 0) {
      const bonus = (levels.economy ?? 0) >= 20 ? 20 : 10;
      const description = starved ? `下次施放耗能 -${bonus}%` : `灵力低于50%时耗能 -${bonus}%`;
      buffs.push({ id: `${ability.id}-economy`, icon: 'economy', name: `${ability.name} · 节能`, description, count: charges > 0 ? charges : undefined });
    }
    if (progress.overload > 0 && progress.overloadCast === 0) {
      const description = (levels.overload ?? 0) >= 10 ? '下次伤害 +20% · 首个目标额外 +25%' : '下次伤害 +20%';
      buffs.push({ id: `${ability.id}-overload`, icon: 'overload', name: `${ability.name} · 过载`, description, remaining: progress.overload });
    }
    if (branch.item.effect === 'thunder-staff' && progress.staff > 0) buffs.push({ id: `${ability.id}-staff`, icon: 'staff', name: `${ability.name} · 蓄雷`, description: '下次攻击伤害 +30%' });
    if (branch.item.effect === 'slash' && (branch.item.level ?? 1) >= 15 && progress.landed >= 3) {
      const range = displayNumber(.35 * branch.areaMultiplier);
      const circle = (branch.item.level ?? 1) >= 20 ? ' · 360°横扫' : '';
      buffs.push({ id: `${ability.id}-sweep`, icon: 'overload', name: `${ability.name} · 蓄势`, description: `下次攻击距离 +${range}米${circle}` });
    }
    if (branch.item.effect === 'dual' && progress.retain > 0) buffs.push({ id: `${ability.id}-retain`, icon: 'attack-haste', name: `${ability.name} · 连击保留`, description: '脱战保留连击进度', remaining: progress.retain });
  }
  return buffs;
}

function BuffSlot({ buff }: { buff: Buff }) {
  const tooltipId = useId();
  const cell = cells[buff.icon]; const x = cell % 4 * 100 / 3; const y = Math.floor(cell / 4) * 25;
  const style: CSSProperties = { backgroundImage: `url(${atlas})`, backgroundPosition: `${x}% ${y}%` };
  const seconds = buff.remaining === undefined ? undefined : Math.ceil(buff.remaining);
  const badge = buff.count === undefined ? seconds === undefined ? undefined : `${seconds}秒` : `×${buff.count}`;
  const status = buff.inside ? '阵内生效' : seconds === undefined ? '' : `剩余 ${seconds}秒`;
  return <div className={s.buff} data-buff={buff.id} tabIndex={0} aria-label={buff.name} aria-describedby={tooltipId}>
    <span className={s.buffTile}><span className={s.buffImage} style={style} />{buff.icon === 'counter' && <small className={s.counterPower}>×2</small>}{badge !== undefined && <small className={s.buffCount}>{badge}</small>}</span>
    <span id={tooltipId} className={s.buffTooltip} role="tooltip"><b>{buff.name}</b><span>{buff.description}</span>{status && <small>{status}</small>}</span>
  </div>;
}

export function BuffBar(props: BuffBarProps) {
  const [counterLeft, setCounterLeft] = useState(props.player.guard?.counterLeft ?? 0);
  useEffect(() => {
    const refresh = () => {
      const current = props.runtime?.readGuard();
      const left = current?.counterLeft ?? props.player.guard?.counterLeft ?? 0;
      const rounded = Math.ceil(left); setCounterLeft(rounded);
    };
    refresh(); const timer = window.setInterval(refresh, 100);
    return () => window.clearInterval(timer);
  }, [props.runtime, props.player.guard?.counterLeft]);
  const current = { ...props, counterLeft };
  const buffs = collectBuffs(current);
  return <div className={s.buffs} aria-label="当前增益">{buffs.map(buff => <BuffSlot key={buff.id} buff={buff} />)}</div>;
}
