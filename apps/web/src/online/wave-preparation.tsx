import { useEffect, useState } from 'react';
import type { BuildStateData, Snapshot } from '@web-game-world/contracts';
import { buildCatalog, equipmentRuntime } from '@web-game-world/simulation';
import content from '../network/content';
import { ShopIcon } from '../lobby/camp/shop-icon';
import portrait from '../character-creator/assets/adventurer.webp';
import { RewardDialog } from './reward-dialog';
import w from './wave-rewards.module.css';

interface Props { state: BuildStateData; added: number; upgraded: Record<string, { before: number; after: number }>; open: (id?: string) => void }

export function WavePreparation(props: Props) {
  const catalog = buildCatalog(content, props.state.items);
  const runtime = equipmentRuntime(props.state.loadout, content, props.state.items);
  const items = catalog.filter(item => item.id === props.state.loadout.heart || props.state.loadout.slots.some(slot => slot?.itemId === item.id));
  return <section className={w.buildStrip} aria-label="构筑变化与调整"><div className={w.buildItems}>{items.map(item => {
    const definition = { ...item, id: item.definitionId ?? item.id };
    const active = item.kind === 'heart' || runtime.branches.some(branch => branch.item.id === item.id);
    const upgrade = props.upgraded[item.id];
    return <button key={item.id} data-active={active} onClick={() => props.open(item.id)} title={`${item.name}${active ? '' : ' · 尚未激活'}`}><ShopIcon item={definition} size={43} /><span>{item.name}<small>{upgrade ? `Lv.${upgrade.before} → ${upgrade.after}` : `Lv.${item.level}`}{!active && ' · 待激活'}</small></span></button>;
  })}</div><button className={w.link} onClick={() => props.open()}>调整构筑{props.added > 0 && ` · 新增 ${props.added}`} ›</button></section>;
}

export function WaveTeam(props: { snapshot: Snapshot; connected: boolean; remind: () => void }) {
  const [opened, setOpened] = useState(false);
  const [pending, setPending] = useState(false);
  const preparation = props.snapshot.preparation;
  useEffect(() => { setPending(false); }, [preparation?.reminded, props.snapshot.round, props.connected]);
  useEffect(() => { if (!pending) return; const timer = window.setTimeout(() => setPending(false), 8000); return () => window.clearTimeout(timer); }, [pending]);
  if (!preparation || preparation.participantIds.length <= 1) return null;
  const participants = props.snapshot.players.filter(player => preparation.participantIds.includes(player.id));
  const waiting = preparation.participantIds.length - preparation.readyIds.length;
  const missing = preparation.participantIds.filter(id => !participants.some(player => player.id === id));
  function remind(): void { if (pending || preparation?.reminded || !props.connected) return; setPending(true); props.remind(); }
  return <div className={w.team}><button className={w.teamSummary} onClick={() => setOpened(true)}>队伍准备 <b>{preparation.readyIds.length}/{preparation.participantIds.length}</b> ›</button><div className={w.roster}>{participants.slice(0, 5).map(player => {
    const ready = preparation.readyIds.includes(player.id);
    return <span key={player.id} title={`${player.name} · ${!player.connected ? '重连中' : ready ? '已准备' : '未准备'}`}><img src={portrait} alt={player.name} /><b data-ready={ready}>{ready ? '✓' : '·'}</b></span>;
  })}{participants.length > 5 && <button className={w.link} onClick={() => setOpened(true)}>+{participants.length - 5}</button>}</div><button className={w.link} disabled={pending || preparation.reminded || waiting <= 0 || !props.connected} onClick={remind}>{preparation.reminded ? '已提醒' : pending ? '正在提醒…' : '提醒'}</button>
    {opened && <RewardDialog title="队伍准备状态" close={() => setOpened(false)}>{participants.map(player => <p key={player.id}>{player.name} · {!player.connected ? '重连中' : preparation.readyIds.includes(player.id) ? '已准备' : '未准备'}</p>)}{missing.map(id => <p key={id}>同行者 · 等待状态同步</p>)}</RewardDialog>}
  </div>;
}
