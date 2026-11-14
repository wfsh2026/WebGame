import { heartSupply, abilityDemand, type equipmentRuntime } from '@web-game-world/simulation';
import s from './attack-rhythm.module.css';
interface Props { recoveryBonus?: number; runtime: ReturnType<typeof equipmentRuntime>; attackSpeed: number; castingSpeed: number }
export function AttackRhythm(props: Props) {
  const branches = [...props.runtime.branches];
  branches.sort((a, b) => { const left = a.item.effect === 'thunder-seal' ? -.1 : a.item.interval; const right = b.item.effect === 'thunder-seal' ? -.1 : b.item.interval; return left - right; });
  const heart = props.runtime.heartItem;
  const supply = heartSupply(heart, props.recoveryBonus);
  let demand = 0; let peakDemand = 0;
  const rows = branches.map((branch, index) => {
    const speed = branch.item.skillType === 'melee' ? props.attackSpeed : props.castingSpeed;
    const beam = branch.item.effect === 'star-beam'; const rawInterval = branch.item.interval * branch.intervalMultiplier / speed; const interval = beam ? Math.max(1.2, rawInterval) : rawInterval; const cost = branch.item.cost * branch.costMultiplier;
    const haste = branch.supportLevels.haste ?? 0; const maximum = haste >= 5 ? 5 : haste >= 3 ? 3 : 0;
    const accelerated = speed * (1 + maximum * .04); const rawSteady = rawInterval / (1 + maximum * .04); const steady = beam ? Math.max(1.2, rawSteady) : rawSteady; const rawQuickest = steady * (haste >= 20 ? .5 : 1); const quickest = beam ? Math.max(1.2, rawQuickest) : rawQuickest;
    demand += abilityDemand(branch, speed); peakDemand += abilityDemand(branch, accelerated) * (haste >= 20 ? 5 / 4.5 : 1);
    const offset = Math.min(index * .1, interval * .4); const points: { time: number; extra: boolean }[] = [];
    for (let count = 0, time = offset; time < 8 && count < 160; count += 1, time += interval) {
      points.push({ time, extra: false });
      if (beam) for (let pulse = 1; pulse < 5; pulse += 1) { const pulseTime = time + pulse * .25; if (pulseTime < 8) points.push({ time: pulseTime, extra: false }); }
      if (branch.unleash && (count + 1) % (branch.unleash >= 3 ? 3 : 4) === 0) {
        const delay = branch.unleash >= 15 ? .12 : .18; const repeats = branch.unleash >= 5 ? 2 : 1;
        for (let repeat = 1; repeat <= repeats; repeat += 1) if (time + repeat * delay < 8) points.push({ time: time + repeat * delay, extra: true });
      }
    }
    const intervalText = interval.toFixed(2); const quickestText = quickest.toFixed(2); const costText = cost.toFixed(1);
    return { branch, points, intervalText, quickestText, costText, beam };
  });
  const supplyText = supply.toFixed(1); const demandText = demand.toFixed(1); const peakText = peakDemand.toFixed(1);
  return <details className={s.panel}><summary>攻击节奏与供能预览</summary><p>● 正常出手　· 释出追加弹；展示所有能力有目标、资源充足时的前 8 秒基础节奏。</p>
    <div className={s.axis}><span>0 秒</span><span>2 秒</span><span>4 秒</span><span>6 秒</span><span>8 秒</span></div>
    {rows.map(row => <div className={s.row} key={row.branch.item.id}><b>{row.branch.item.name}</b><span>间隔 {row.intervalText} 秒 · {row.beam ? '每脉冲消耗' : '消耗'} {row.costText} 灵力{row.quickestText !== row.intervalText ? ` · 条件满足时最快 ${row.quickestText} 秒` : ''}</span><div className={s.track}>{row.points.map((point, index) => { const left = `${point.time / 8 * 100}%`; const title = `${point.time.toFixed(2)} 秒 · ${point.extra ? '释出' : '正常出手'}`; return <i key={index} className={point.extra ? s.extra : s.normal} style={{ left }} title={title}>{point.extra ? '·' : '●'}</i>; })}</div></div>)}
    <p>基础供给 {supplyText}/秒 · 基础需求 {demandText}/秒 · 连续加速时约 {peakText}/秒。</p>
    {(demand > supply || peakDemand > supply) && <strong>连续施放可能等待供能。提高攻击频率不会自动提高心法恢复速度。</strong>}
    <p>节能、聚灵和共鸣折扣、心法条件恢复会改变实际消耗与供给。目标距离、飞行命中、返程及缺能等待不在此时间图中预估；追加效果已包含在原施放成本中。战旗按持续转移、最短间隔布置估算；原地维持不会重复扣费，实际需求通常更低。</p></details>;
}
