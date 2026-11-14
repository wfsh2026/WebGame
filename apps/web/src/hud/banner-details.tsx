import { bannerAttackDamage, bannerAttackPattern, bannerConfig, isBanner } from '@web-game-world/simulation';
import type { equipmentRuntime } from '@web-game-world/simulation';
import { displayNumber } from './display-number';
export function BannerDetails({ branch, magicalAttack }: { branch?: ReturnType<typeof equipmentRuntime>['branches'][number]; magicalAttack?: number }) {
  if (!branch || !isBanner(branch.item.effect)) return null;
  const config = bannerConfig(branch); const radius = displayNumber(config.radius); const duration = displayNumber(config.duration);
  const linger = displayNumber(config.linger); const strength = displayNumber(config.strength); const cost = displayNumber(branch.item.cost * branch.costMultiplier);
  const energy = branch.item.effect === 'banner-energy'; const budget = displayNumber(branch.item.cost * branch.costMultiplier * .8);
  const pattern = bannerAttackPattern(branch.item.effect ?? ''); const interval = displayNumber(pattern.interval);
  const coefficient = bannerAttackDamage(branch, 100); const coefficientText = displayNumber(coefficient);
  const damage = magicalAttack === undefined ? undefined : bannerAttackDamage(branch, magicalAttack);
  const damageText = damage === undefined ? `${coefficientText}%魔攻` : displayNumber(damage);
  return <div><p>{pattern.name} · 基础每击 {damageText} · 攻击周期 {interval} 秒</p><p>旗阵半径 {radius} 米 · 有效持续 {duration} 秒 · 离阵保留 {linger} 秒</p><p>增益强度 ×{strength} · 同种最多 {config.maximum} 面 · 每面消耗 {cost} 灵力</p><p>布旗一次付费，持续期间自动攻击。自身同类重叠伤害取强，友方同类增益取强。</p>{energy && <p>自身额外回灵预算 {budget}，队友收益单独计算。</p>}</div>;
}
