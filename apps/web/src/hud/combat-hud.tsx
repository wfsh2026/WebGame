import { equipmentRuntime } from '@web-game-world/simulation';
import { BuffBar } from './combat-buffs';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { BattleRuntime } from '../game/battle-runtime';
import type { CSSProperties } from 'react';
import type { AbilityView, PlayerView } from '@web-game-world/contracts';
import portrait from '../../../../content/common/lobby/camp-portrait.webp';
import s from './combat-hud.module.css';
import content from '../network/content';
import { ExperienceBar } from './experience-bar';
import { HudIcon, ItemIcon } from './hud-icon';

export function BattlePortrait() {
  return <span className={s.portrait}><img src={portrait} alt="" /></span>;
}

function ResourceBar({ label, value, max }: { label: string; value: number; max: number }) {
  const bounded = Math.max(0, value); const percentage = max > 0 ? Math.min(100, bounded / max * 100) : 0;
  const style = { width: `${percentage}%` }; const current = Math.ceil(bounded); const total = Math.ceil(max);
  return <div className={s.resource} data-resource={label} aria-label={`${label} ${current}/${total}`}><span style={style} /><b>{current} / {total}</b></div>;
}

function AbilitySlot({ ability, runtime }: { ability: AbilityView; runtime: BattleRuntime }) {
  const [remaining, setRemaining] = useState(ability.remaining);
  const previous = useRef(ability.triggers); const [flash, setFlash] = useState(false);
  useEffect(() => {
    const refresh = () => {
      const cooldown = runtime.readAbilityCooldown(ability.id) ?? ability.remaining;
      const bounded = Math.max(0, cooldown); const rounded = Math.ceil(bounded * 10) / 10; setRemaining(rounded);
    };
    refresh(); const timer = window.setInterval(refresh, 50);
    return () => window.clearInterval(timer);
  }, [runtime, ability.id, ability.remaining]);
  useEffect(() => {
    if (previous.current === ability.triggers) return;
    previous.current = ability.triggers; setFlash(true);
    const clear = () => setFlash(false); const timer = window.setTimeout(clear, 230);
    return () => window.clearTimeout(timer);
  }, [ability.triggers]);
  const ratio = ability.interval > 0 ? Math.min(1, remaining / ability.interval) : 0;
  const style: CSSProperties = { background: `conic-gradient(#07100fd6 ${ratio * 360}deg, transparent 0deg)` };
  const countdown = remaining.toFixed(1);
  const waiting = remaining === 0 && ability.state !== '就绪' && ability.state !== '已触发' && ability.state !== '计时中';
  const starved = ability.state.includes('供能') || ability.state.includes('灵力');
  const status = starved ? '缺灵力' : ability.state; const interval = ability.interval.toFixed(2);
  const detail = `${ability.name} · ${ability.skillType === 'melee' ? '近战技能' : '远程技能'} · ${ability.cost} 灵力 · 间隔 ${interval} 秒 · ${ability.state}`;
  return <div className={s.ability} data-triggered={flash} data-waiting={waiting} tabIndex={0} role="img" aria-label={detail} title={detail}>
    <div className={s.gem}><ItemIcon effect={ability.icon} /><span className={s.cooldown} style={style} />{remaining > 0 && <strong className={s.countdown}>{countdown}</strong>}</div>
    {waiting && <span className={s.waiting} data-starved={starved}>{status}</span>}<span className={s.abilityName}>{ability.name}</span>
  </div>;
}

function DashSlot({ player, runtime }: { player: PlayerView; runtime: BattleRuntime }) {
  const [remaining, setRemaining] = useState(player.dashCooldown);
  useEffect(() => {
    const refresh = () => {
      const cooldown = runtime.readDashCooldown() ?? player.dashCooldown;
      const rounded = Math.ceil(cooldown * 10) / 10; setRemaining(rounded);
    };
    refresh(); const timer = window.setInterval(refresh, 50);
    return () => window.clearInterval(timer);
  }, [runtime, player.dashCooldown]);
  const countdown = remaining.toFixed(1); const unavailable = player.hp <= 0 || player.blocking;
  const status = player.hp <= 0 ? '不可用' : player.blocking ? '格挡中' : remaining > 0 ? `${countdown}秒` : '就绪';
  const ready = !unavailable && remaining === 0; const detail = `Shift 冲刺 · ${status}`;
  const ratio = Math.min(1, remaining / 3);
  const style: CSSProperties = { background: `conic-gradient(#07100fd6 ${ratio * 360}deg, transparent 0deg)` };
  return <div className={`${s.ability} ${s.control}`} data-ready={ready} data-unavailable={unavailable} tabIndex={0} role="img" aria-label={detail} title={detail}>
    <div className={s.gem}><HudIcon name="dash" /><span className={s.cooldown} style={style} />{remaining > 0 && <strong className={s.countdown}>{countdown}</strong>}</div>
    <kbd className={s.controlKey}>Shift</kbd>{unavailable && <span className={s.waiting}>{status}</span>}<span className={s.abilityName}>冲刺</span>
  </div>;
}

function BlockSlot({ player, runtime }: { player: PlayerView; runtime: BattleRuntime }) {
  const [guard, setGuard] = useState({ blocking: player.blocking, perfect: (player.guard?.windowLeft ?? 0) > 0 });
  useEffect(() => {
    const refresh = () => {
      const current = runtime.readGuard();
      const blocking = current?.blocking ?? player.blocking;
      const perfect = (current?.windowLeft ?? player.guard?.windowLeft ?? 0) > 0;
      setGuard(previous => previous.blocking === blocking && previous.perfect === perfect ? previous : { blocking, perfect });
    };
    refresh(); const timer = window.setInterval(refresh, 50);
    return () => window.clearInterval(timer);
  }, [runtime, player.blocking, player.guard?.windowLeft]);
  const unavailable = player.hp <= 0 || player.dashLeft > 0;
  const status = player.hp <= 0 ? '不可用' : player.dashLeft > 0 ? '冲刺中' : guard.blocking ? guard.perfect ? '精防窗口' : '减伤50%' : '就绪';
  const detail = `Space 全方位格挡 · ${status} · 按下后0.25秒内命中触发精防，免伤并获得10秒伤害×2；持续格挡减伤50%`;
  return <div className={`${s.ability} ${s.control}`} data-active={guard.blocking} data-perfect={guard.blocking && guard.perfect} data-unavailable={unavailable} tabIndex={0} role="img" aria-label={detail} title={detail}>
    <div className={s.gem}><HudIcon name="block" /></div><kbd className={s.controlKey}>Space</kbd>
    {(guard.blocking || unavailable) && <span className={s.waiting}>{status}</span>}<span className={s.abilityName}>格挡</span>
  </div>;
}

function HealthWarning({ runtime }: { runtime: BattleRuntime }) {
  const state = useSyncExternalStore(runtime.subscribeHealth, runtime.readHealth, runtime.readHealth);
  const label = state === 'critical' ? '濒危' : state === 'low' ? '低血量' : '';
  return <span className={s.healthWarning} data-state={state} role="status">{label}</span>;
}

export function CombatHud({ player, players, abilities, runtime }: { player: PlayerView; players: PlayerView[]; abilities: AbilityView[]; runtime: BattleRuntime }) {
  const teammates = players.filter(item => item.id !== player.id);
  const [teamOpen, setTeamOpen] = useState(players.length <= 4);
  const equipment = player.loadout ? equipmentRuntime(player.loadout, content, player.buildItems) : undefined;
  const bannerShield = player.banners?.buffs.reduce((total, buff) => total + buff.shield, 0) ?? 0;
  const shield = Math.ceil((player.lootShield ?? 0) + bannerShield);
  const living = players.filter(item => item.hp > 0).length;
  return <div className={s.overlay}>
    <section className={s.party} aria-label="角色与队伍">
      <div className={s.selfFrame}>
      <div className={s.self}><BattlePortrait /><div className={s.resources}>
        <div className={s.identity}><b>{player.name}</b>{shield > 0 && <span className={s.shield}><HudIcon name="block" size={22} />护盾 {shield}</span>}</div>
        <div className={s.health}><ResourceBar label="生命" value={player.hp} max={player.maxHp} /><HealthWarning runtime={runtime} /></div>
        <div className={s.energy}><ResourceBar label="灵力" value={player.energy} max={player.capacity} /></div>
      </div></div>
      <ExperienceBar level={player.level ?? 1} experience={player.experience ?? 0} />
      </div>
      {teammates.length > 0 && <details className={s.team} open={teamOpen} onToggle={event => setTeamOpen(event.currentTarget.open)}><summary>队伍 {living} / {players.length} 存活</summary><div className={s.teamList}>
        {teammates.map(teammate => <div className={s.teammate} key={teammate.id} data-soul={teammate.hp <= 0}><BattlePortrait /><div className={s.resources}><span>{teammate.name}</span>{!teammate.connected ? <small>重连中</small> : teammate.hp <= 0 ? <small>灵魂 · {Math.ceil(teammate.reviveRemaining)}秒</small> : <ResourceBar label="生命" value={teammate.hp} max={teammate.maxHp} />}</div></div>)}
      </div></details>}
    </section>
    <section className={s.loadout} aria-label="已装备近战与远程技能及冲刺格挡">
      <BuffBar player={player} abilities={abilities} equipment={equipment} runtime={runtime} />
      <div className={s.dock}><div className={s.automatic}><div className={s.abilities}>{abilities.map(ability => <AbilitySlot key={ability.id} ability={ability} runtime={runtime} />)}</div></div><div className={s.controls}><DashSlot player={player} runtime={runtime} /><BlockSlot player={player} runtime={runtime} /></div></div>
    </section>
  </div>;
}
