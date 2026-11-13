import type { BuildStateData, PlayerView, Snapshot } from '@web-game-world/contracts';
import { buildCatalog, waveProfile } from '@web-game-world/simulation';
import content from '../network/content';
import { EquipmentIcon } from '../hud/equipment-icon';
import portrait from '../character-creator/assets/adventurer.webp';
import s from './wave-preparation.module.css';

interface Props { snapshot: Snapshot; state: BuildStateData; player?: PlayerView; unseen: number; ready: (ready: boolean) => void; remind: () => void; open: (tab: 'level' | 'wave' | 'skills') => void }
export function WavePreparation(props: Props) {
  const preparation = props.snapshot.preparation;
  if (!preparation) return null;
  const participants = props.snapshot.players.filter(player => preparation.participantIds.includes(player.id));
  const ready = props.player ? preparation.readyIds.includes(props.player.id) : false;
  const context = { config: content }; const next = waveProfile(context, props.snapshot.round + 1);
  const catalog = buildCatalog(content, props.state.items);
  const heart = catalog.find(item => item.id === props.state.loadout.heart);
  const minutes = Math.floor(Math.max(0, props.snapshot.serverTime - preparation.startedAt) / 60000);
  const seconds = Math.floor(Math.max(0, props.snapshot.serverTime - preparation.startedAt) / 1000) % 60;
  const secondsText = String(seconds).padStart(2, '0');
  const waiting = participants.filter(player => !preparation.readyIds.includes(player.id));
  return <section className={s.preparation}><p className={s.subtitle}>第 {props.snapshot.round} 波已完成 · 整理奖励与构筑，准备好后再出发</p><div className={s.layout}>
    <div><div className={s.cards}>
      <article><EquipmentIcon kind="weapon" effect="slash" size={100} /><h3>升级奖励 ×{props.state.upgradeCredits}</h3><p>强化已有能力</p><button onClick={() => props.open('level')}>选择成长</button></article>
      <article><EquipmentIcon kind="skill" effect="star" size={100} /><h3>波次奖励 ×{props.state.waveCredits}</h3><p>补足构筑与新能力</p><button onClick={() => props.open('wave')}>领取奖励</button></article>
      <article><EquipmentIcon kind="heart" size={100} /><h3>新获得物品 ×{props.unseen}</h3><p>查看掉落与替换对比</p><button onClick={() => props.open('skills')}>整理构筑</button></article>
    </div><div className={s.build}><h3>当前构筑</h3><p>本波金币 +10 · 已累计 {props.snapshot.results.filter(result => result.success).length * 10} · 最终结算发放</p><div className={s.branches}>
      <button onClick={() => props.open('skills')}><EquipmentIcon kind="heart" effect={heart?.effect} size={54} /><b>{heart?.name ?? '未装备心法'}</b><small>{heart ? `Lv.${heart.level}` : '点击装配'}</small></button>
      {props.state.loadout.slots.map((slot, index) => { const ability = catalog.find(item => item.id === slot?.itemId); return <button key={index} onClick={() => props.open('skills')}>{ability && <EquipmentIcon kind={ability.kind} effect={ability.effect} size={45} />}<b>{ability?.name ?? `能力槽 ${index + 1}`}</b><small>{ability ? `Lv.${ability.level}` : '空槽'}</small><span className={s.gems}>{slot?.supports.map((id, socket) => { const gem = catalog.find(item => item.id === id); return gem ? <span key={socket} title={gem.name}><EquipmentIcon kind="support" effect={gem.effect} size={24} /></span> : <small key={socket}>空</small>; })}</span></button>; })}
    </div></div></div>
    <aside className={s.team}><h3>队伍准备 {preparation.readyIds.length} / {participants.length}</h3><p>已等待 {minutes}:{secondsText}</p><div className={s.roster}>{participants.map(player => { const done = preparation.readyIds.includes(player.id); const status = !player.connected ? '重连中' : done ? '已准备' : player.hp <= 0 ? '灵魂 · 未准备' : '未准备'; return <div key={player.id} data-ready={done} title={`${player.name} · ${status}`}><img src={portrait} alt="" /><b>{done ? '✓' : '○'}</b><span>{player.name}</span><small>{status}</small></div>; })}</div><details><summary>查看未准备队员 · {waiting.length}</summary>{waiting.map(player => <p key={player.id}>{player.name} · {player.connected ? '等待准备' : '等待重连，宽限期结束后退出名单'}</p>)}</details><button disabled={preparation.reminded || waiting.length === 0} onClick={props.remind}>{preparation.reminded ? '本波已提醒' : '提醒准备'}</button></aside>
  </div><footer className={s.footer}><div><b>下一波 · 第 {props.snapshot.round + 1} 波 · {next.wave.name}</b><p>{next.wave.hint}</p><small>未选奖励会保留。准备时间不累计生存收益，消耗品拾取即用。</small></div><div><strong>{preparation.countdown > 0 ? `${Math.ceil(preparation.countdown)} 秒后开战` : ready ? '等待队友准备' : '你尚未准备'}</strong><button className={s.ready} onClick={() => props.ready(!ready)}>{ready ? '取消准备' : participants.length === 1 ? '开始下一波' : '准备完成'}</button><small>全员准备后 3 秒开战，倒计时期间可取消。</small></div></footer></section>;
}
