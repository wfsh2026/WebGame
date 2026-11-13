import { bannerConfig, isBanner } from '@web-game-world/simulation';
import type { equipmentRuntime } from '@web-game-world/simulation';
import { displayNumber } from './display-number';
export function BannerDetails({ branch }: { branch?: ReturnType<typeof equipmentRuntime>['branches'][number] }) {
  if (!branch || !isBanner(branch.item.effect)) return null;
  const config = bannerConfig(branch); const radius = displayNumber(config.radius); const duration = displayNumber(config.duration);
  const linger = displayNumber(config.linger); const strength = displayNumber(config.strength); const cost = displayNumber(branch.item.cost * branch.costMultiplier);
  const energy = branch.item.effect === 'banner-energy'; const budget = displayNumber(branch.item.cost * branch.costMultiplier * .8);
  return <div><p>旗阵半径 {radius} 米 · 有效持续 {duration} 秒 · 离阵保留 {linger} 秒</p><p>增益强度 ×{strength} · 同种最多 {config.maximum} 面 · 每面消耗 {cost} 灵力</p><p>交战且离开旧旗范围或旧旗到期时自动布置。同类增益取最强，8 种有效辅助中选择最多 5 种。</p>{energy && <p>心法仍消耗角色魔法值；每面旗给自身带来的额外灵力预算不超过 {budget}，队友收益不占此预算。</p>}</div>;
}
