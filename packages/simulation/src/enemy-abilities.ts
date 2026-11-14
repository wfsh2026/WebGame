import type { Enemy, Simulation, Vec } from './index';

export interface EnemyAbilityState {
  tier: number; phase: number; cycle: number; step: number; mode: string; windup: number;
  links: string[]; supportWait: number;
}

export function enemyRank(enemy: Enemy): number {
  return enemy.definition.rank === 'boss' ? 2 : enemy.definition.rank === 'elite' ? 1 : 0;
}

export function enemyAbilities(enemy: Enemy): EnemyAbilityState {
  if (enemy.abilities) return enemy.abilities;
  const cycle = Math.floor(((enemy.bornWave ?? 1) - 1) / 10);
  const tier = enemy.parentId ? 0 : Math.min(3, cycle);
  enemy.abilities = { tier, phase: 0, cycle: 0, step: 0, mode: '', windup: enemy.definition.windup, links: [], supportWait: 0 };
  return enemy.abilities;
}

export function beginEnemyCycle(enemy: Enemy): EnemyAbilityState {
  const ability = enemyAbilities(enemy); const rank = enemyRank(enemy);
  ability.phase = rank === 2 && ability.tier > 0 && enemy.hp <= enemy.maxHp * .5 ? 1 : 0;
  ability.cycle += 1; ability.step = 0;
  return ability;
}

export function enemyShielded(enemy: Enemy): boolean {
  return enemy.definition.behavior === 'shield' && (enemy.state === 'chase' || enemy.state === 'seek' || enemy.state === 'guard');
}

export function enemyTarget(sim: Simulation, enemy: Enemy): Simulation['players'][number] | undefined {
  const current = sim.players.find(player => player.id === enemy.targetId && player.hp > 0);
  if (current) return current;
  let target: Simulation['players'][number] | undefined; let best = Infinity;
  for (const player of sim.players) {
    if (player.hp <= 0) continue;
    const dx = player.x - enemy.x; const dy = player.y - enemy.y; const squared = dx * dx + dy * dy;
    if (squared < best || (squared === best && player.id < (target?.id ?? '~'))) { best = squared; target = player; }
  }
  enemy.targetId = target?.id ?? ''; return target;
}

export function faceEnemy(enemy: Enemy, target: Vec): void {
  const dx = target.x - enemy.x; const dy = target.y - enemy.y; const separation = Math.hypot(dx, dy);
  if (separation < .001) return;
  enemy.facingX = dx / separation; enemy.facingY = dy / separation;
}

export function canBeginEnemyAttack(sim: Simulation, enemy: Enemy): boolean {
  const sources = new Set<string>();
  for (const other of sim.enemies) {
    if (other === enemy || other.hp <= 0) continue;
    if (other.state !== 'windup' && other.state !== 'charge' && other.state !== 'channel' && other.state !== 'detonating') continue;
    const dx = enemy.x - other.x; const dy = enemy.y - other.y;
    if (dx * dx + dy * dy < 49) sources.add(other.id);
  }
  for (const hazard of sim.hazards) {
    if (hazard.owner === enemy.id || hazard.kind === 'egg') continue;
    const dx = enemy.x - hazard.x; const dy = enemy.y - hazard.y;
    if (dx * dx + dy * dy < 49) sources.add(hazard.owner);
  }
  const floor = sim.config.expedition ? Math.max(0, sim.round - sim.config.expedition.stages) : 0;
  const limit = floor >= 6 ? 4 : floor > 0 || sim.config.difficulty === 'nightmare' ? 3 : 2;
  return sources.size < limit;
}

export function enemyShotAngles(enemy: Enemy): number[] {
  const rank = enemyRank(enemy); const ability = enemyAbilities(enemy);
  const base = Math.atan2(enemy.facingY, enemy.facingX);
  let offsets = rank === 0 ? [0] : rank === 1 ? [-.3, 0, .3] : [-.6, -.3, 0, .3, .6];
  if (ability.step > 0) offsets = rank === 1 ? [-.15, .15] : [-.45, -.15, .15, .45];
  if (rank === 2 && ability.mode === 'sequence') offsets = [(ability.step - 1) * .28];
  const variant = ability.tier > 0 && ability.cycle % 2 === 0 ? .09 : 0;
  return offsets.map(offset => base + offset + variant);
}
