import { expeditionDifficulties } from './expedition';
import { grantExperience } from './build-growth';
import type { Arena, Enemy, Player, Simulation, Vec } from './index';

export interface ExperienceOrb extends Vec { id: string; playerId: string; amount: number; wave: number; bornAt: number; flyingAt?: number }
export const experienceFlightSeconds = .42;

export function canCollectDrop(arena: Arena, from: Vec, to: Vec): boolean {
  const dx = to.x - from.x; const dy = to.y - from.y;
  for (const obstacle of arena.obstacles) {
    let near = 0; let far = 1;
    const axes = [{ start: from.x, delta: dx, low: obstacle.x, high: obstacle.x + obstacle.width }, { start: from.y, delta: dy, low: obstacle.y, high: obstacle.y + obstacle.height }];
    for (const axis of axes) {
      if (Math.abs(axis.delta) < .000001) { if (axis.start < axis.low || axis.start > axis.high) { near = 2; break; } continue; }
      const first = (axis.low - axis.start) / axis.delta; const second = (axis.high - axis.start) / axis.delta;
      const low = Math.min(first, second); const high = Math.max(first, second);
      near = Math.max(near, low); far = Math.min(far, high);
    }
    if (near <= far) return false;
  }
  return true;
}

export function dropCombatExperience(sim: Simulation, player: Player, reward: { enemy: Enemy; kill: boolean }): void {
  if (sim.presentationOnly || player.level >= 100) return;
  const enemy = reward.enemy; const base = reward.kill ? 4 : 2;
  const setting = expeditionDifficulties[sim.config.difficulty ?? 'normal']; const amount = base * setting.experience;
  const id = `xp:${enemy.id}:${player.id}`;
  if (sim.experienceOrbs.some(orb => orb.id === id)) return;
  const nearby = sim.experienceOrbs.find(orb => {
    if (orb.playerId !== player.id || orb.flyingAt !== undefined || orb.wave !== sim.round || orb.amount >= 64) return false;
    const separation = Math.hypot(orb.x - enemy.x, orb.y - enemy.y);
    return separation < .55;
  });
  if (nearby) { nearby.amount += amount; return; }
  sim.experienceOrbs.push({ id, playerId: player.id, amount, wave: sim.round, bornAt: sim.clock, x: enemy.x, y: enemy.y });
}

export function stepExperience(sim: Simulation): void {
  if (sim.presentationOnly) return;
  const retained: ExperienceOrb[] = [];
  for (const orb of sim.experienceOrbs) {
    const player = sim.players.find(entry => entry.id === orb.playerId);
    if (!player) continue;
    if (orb.flyingAt !== undefined) {
      if (sim.clock < orb.flyingAt + experienceFlightSeconds) { retained.push(orb); continue; }
      grantExperience(sim, player, orb.amount);
      sim.effects.push({ id: `absorbed:${orb.id}`, kind: 'experience-absorb', owner: player.id, x: player.x, y: player.y, radius: .4, ttl: .8, duration: .8, amount: orb.amount });
      continue;
    }
    retained.push(orb);
    if (player.hp <= 0 || !player.connected || sim.clock - orb.bornAt < .35) continue;
    const separation = Math.hypot(player.x - orb.x, player.y - orb.y);
    if (separation > 1.5) continue;
    const reachable = canCollectDrop(sim.arena, orb, player);
    if (reachable) orb.flyingAt = sim.clock;
  }
  sim.experienceOrbs = retained;
}

export function settleClaimedExperience(sim: Simulation): void {
  if (sim.presentationOnly) return;
  for (const orb of sim.experienceOrbs) {
    if (orb.flyingAt === undefined) continue;
    const player = sim.players.find(entry => entry.id === orb.playerId);
    if (player) grantExperience(sim, player, orb.amount);
  }
  sim.experienceOrbs = [];
}
