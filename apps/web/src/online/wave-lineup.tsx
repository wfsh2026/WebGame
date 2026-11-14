import type { WavePlanView } from '@web-game-world/contracts';
import content from '../network/content';

export function WaveLineup(props: { plan?: WavePlanView; timeline?: boolean }) {
  const plan = props.plan;
  if (!plan) return null;
  const counts = new Map<string, number>();
  const tiers = new Map<string, number>();
  for (const batch of plan.batches) {
    const previous = counts.get(batch.kind) ?? 0;
    counts.set(batch.kind, previous + batch.count);
    tiers.set(batch.kind, batch.tier);
  }
  const entries = [...counts.entries()];
  const labels = entries.map(([kind, count]) => {
    const definition = content.enemies.find(enemy => enemy.kind === kind);
    const tier = tiers.get(kind) ?? 0;
    const enhancement = tier > 0 ? `（强化${tier}）` : '';
    return `${definition?.name ?? kind}${enhancement} ×${count}`;
  });
  const lineup = labels.join('、');
  return <div><p>{lineup}</p>{props.timeline && <details><summary>查看出场编排</summary><ol>{plan.batches.map((batch, index) => {
    const definition = content.enemies.find(enemy => enemy.kind === batch.kind);
    const seconds = batch.at.toFixed(1);
    const rounded = Math.round(batch.angle / (Math.PI / 2));
    const side = (rounded % 4 + 4) % 4;
    const direction = ['东侧', '南侧', '西侧', '北侧'][side];
    return <li key={index}>{seconds} 秒预警 · {direction} · {definition?.name ?? batch.kind} ×{batch.count}</li>;
  })}</ol></details>}</div>;
}
