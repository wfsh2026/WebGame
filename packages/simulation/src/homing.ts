import type { Enemy, Projectile, Simulation } from './index';

export function homingStats(level: number) {
  const tier = level >= 20 ? 4 : level >= 15 ? 3 : level >= 10 ? 2 : level >= 5 ? 1 : 0;
  return { range: level >= 20 ? 4 : level >= 10 ? 3.5 : 3, turnDegrees: 180 + tier * 30, startDistance: .8 };
}

export function initializeHoming(sim: Simulation, shot: Projectile): void {
  if (!shot.homing || !shot.targetId) return;
  const claimed = sim.projectiles.some(other => other.id !== shot.id && other.castId === shot.castId && other.ttl > 0 && (other.delay ?? 0) <= 0 && !other.returning && other.targetId === shot.targetId);
  if (claimed) shot.targetId = undefined;
}

export function guideHoming(sim: Simulation, shot: Projectile, step: { dt: number; candidates: Enemy[] }): void {
  if (!shot.homing || shot.hostile || shot.returning) return;
  const settings = homingStats(shot.homing);
  const speed = Math.hypot(shot.vx, shot.vy);
  const travelled = shot.homingTravel ?? 0;
  const flight = Math.min(step.dt, shot.ttl);
  shot.homingTravel = travelled + speed * flight;
  if (speed <= 0 || shot.homingTravel < settings.startDistance) return;
  const hits = sim.castHits[shot.castId ?? shot.id]?.ids ?? [];
  let target: Enemy | undefined;
  let selected: Enemy | undefined;
  let bestReserved = Infinity; let bestAlignment = -Infinity; let bestDistance = Infinity;
  const reserved = new Set<string>();
  let collected = false;
  for (const enemy of step.candidates) {
    if (enemy.hp <= 0 || enemy.state === 'detonating' || enemy.state === 'escaped' || enemy.state === 'spent' || hits.includes(enemy.id) || shot.hitIds?.includes(enemy.id)) continue;
    const dx = enemy.x - shot.x; const dy = enemy.y - shot.y;
    const distance = Math.hypot(dx, dy);
    if (distance > settings.range) continue;
    // Keep a living locked target while it remains nearby, even as it moves sideways.
    if (enemy.id === shot.targetId) { target = enemy; break; }
    const alignment = distance > 0 ? (dx * shot.vx + dy * shot.vy) / (distance * speed) : 1;
    if (alignment < .5) continue;
    if (!collected) {
      for (const other of sim.projectiles) {
        if (other.id !== shot.id && other.castId === shot.castId && other.ttl > 0 && (other.delay ?? 0) <= 0 && !other.returning && other.targetId) reserved.add(other.targetId);
      }
      collected = true;
    }
    const claimed = reserved.has(enemy.id) ? 1 : 0;
    const better = claimed < bestReserved || claimed === bestReserved && (alignment > bestAlignment || alignment === bestAlignment && (distance < bestDistance || distance === bestDistance && enemy.id < (selected?.id ?? '\uffff')));
    if (!better) continue;
    selected = enemy; bestReserved = claimed; bestAlignment = alignment; bestDistance = distance;
  }
  target ??= selected;
  shot.targetId = target?.id;
  if (!target) return;
  const desired = Math.atan2(target.y - shot.y, target.x - shot.x);
  const current = Math.atan2(shot.vy, shot.vx); const difference = desired - current;
  const sine = Math.sin(difference); const cosine = Math.cos(difference);
  const shortest = Math.atan2(sine, cosine);
  const turningTime = Math.min(flight, (shot.homingTravel - settings.startDistance) / speed);
  const maximum = settings.turnDegrees * Math.PI / 180 * turningTime;
  const lower = Math.max(-maximum, shortest); const turn = Math.min(maximum, lower);
  const angle = current + turn;
  shot.vx = Math.cos(angle) * speed; shot.vy = Math.sin(angle) * speed;
}
