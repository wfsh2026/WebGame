import { bannerKinds, bannerNames } from '@web-game-world/simulation';
import { EquipmentIcon } from './equipment-icon';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AbilityView, PlayerView } from '@web-game-world/contracts';
import portrait from '../character-creator/assets/adventurer.webp';
import s from './combat-hud.module.css';

export function BattlePortrait() {
  return <span className={s.portrait}><img src={portrait} alt="" /></span>;
}

function ResourceBar({ label, value, max }: { label: string; value: number; max: number }) {
  const bounded = Math.max(0, value);
  const percentage = max > 0 ? bounded / max * 100 : 0;
  const style = { width: `${percentage}%` };
  const current = Math.ceil(bounded);
  const total = Math.ceil(max);
  return <div className={s.resource} data-resource={label} aria-label={`${label} ${current}/${total}`}><span style={style} /><b>{current} / {total}</b></div>;
}

function AbilitySlot({ ability, receivedAt }: { ability: AbilityView; receivedAt: number }) {
  const [now, setNow] = useState(receivedAt);
  const previous = useRef(ability.triggers);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => { const time = performance.now(); setNow(time); }, 50);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (previous.current === ability.triggers) return;
    previous.current = ability.triggers; setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 230);
    return () => window.clearTimeout(timer);
  }, [ability.triggers]);
  const age = Math.max(0, (now - receivedAt) / 1000);
  const remaining = Math.max(0, ability.remaining - age);
  const ratio = Math.min(1, remaining / ability.interval);
  const style: CSSProperties = { background: `conic-gradient(rgba(4, 13, 12, .78) ${ratio * 360}deg, transparent 0deg)` };
  const countdown = remaining.toFixed(1);
  const waiting = remaining === 0 && ability.state !== '就绪' && ability.state !== '已触发' && ability.state !== '计时中';
  const detail = `${ability.name} · ${ability.kind === 'weapon' ? '武器' : '技能'} · ${ability.cost} 灵力 · 间隔 ${ability.interval.toFixed(2)} 秒 · ${ability.state}`;
  return <div className={s.ability} data-icon={ability.icon} data-triggered={flash} data-waiting={waiting} tabIndex={0} role="img" aria-label={detail} title={detail}>
    <EquipmentIcon kind={ability.kind} effect={ability.icon} />
    <span className={s.cooldown} style={style} />
    {remaining > 0 && <strong className={s.countdown}>{countdown}</strong>}
    {waiting && <span className={s.waiting}>{ability.state}</span>}
    <span className={s.abilityName}>{ability.name}</span>
  </div>;
}

export function CombatHud({ player, players, abilities }: { player: PlayerView; players: PlayerView[]; abilities: AbilityView[] }) {
  const receivedAt = performance.now();
  const teammates = players.filter(item => item.id !== player.id);
  return <div className={s.overlay}>
    <section className={s.party} aria-label="角色与队伍">
      <div className={s.self}><BattlePortrait /><div className={s.resources}><b>{player.name}</b><ResourceBar label="生命" value={player.hp} max={player.maxHp} /><ResourceBar label="魔法" value={player.mp} max={player.maxMp} /></div></div>
      <div aria-label="消耗品增益">
        {(player.hasteLeft ?? 0) > 0 && <small>疾行 +15% · {Math.ceil(player.hasteLeft ?? 0)}秒　</small>}
        {(player.focusLeft ?? 0) > 0 && <small>聚灵 · {Math.ceil(player.focusLeft ?? 0)}秒　</small>}
        {(player.lootShield ?? 0) > 0 && <small>护盾 {Math.ceil(player.lootShield ?? 0)} · {Math.ceil(player.shieldLeft ?? 0)}秒</small>}
      </div>
      <div className={s.bannerBuffs} aria-label="战旗增益">{player.hp > 0 && player.banners?.buffs.filter(buff => buff.remaining > 0 && buff.strength > 0).map(buff => {
        const row = bannerKinds.indexOf(buff.kind); const name = bannerNames[row]; const remaining = buff.remaining.toFixed(1);
        const status = buff.inside ? '阵内生效' : `余韵 ${remaining}秒`; const shield = buff.shield > 0 ? ` · 护盾 ${Math.ceil(buff.shield)}` : '';
        const title = `${name} · ${status}${shield} · 同类取最强`;
        return <span key={buff.kind} title={title}><EquipmentIcon kind="skill" effect={buff.kind} size={22} /><small>{name.slice(0, 2)} {buff.inside ? '' : remaining}</small></span>;
      })}</div>
      {teammates.map((teammate, index) => <div className={s.teammate} key={teammate.id}><span className={s.teamNumber}>{index + 2}</span><BattlePortrait /><div className={s.resources}><span>{teammate.name}{!teammate.connected ? ' · 离线' : teammate.hp <= 0 ? ` · 灵魂 ${Math.ceil(teammate.reviveRemaining)}秒` : ''}</span><ResourceBar label="生命" value={teammate.hp} max={teammate.maxHp} /></div></div>)}
    </section>
    <section className={s.loadout} aria-label="已装备武器与技能"><div className={s.energy}><span>灵力</span><ResourceBar label="灵力" value={player.energy} max={player.capacity} /></div><div className={s.abilities}>{abilities.map(ability => <AbilitySlot key={ability.id} ability={ability} receivedAt={receivedAt} />)}</div></section>

  </div>;
}
