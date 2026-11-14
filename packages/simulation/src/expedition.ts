import type { SimConfig, Simulation, WaveDefinition } from './index';

export type ExpeditionDifficulty = 'normal' | 'hard' | 'nightmare';
export interface ExpeditionRules { stages: number; hellStages: number; hellSeconds: number }
export const expeditionDifficulties = {
  normal: { name: '普通', health: 1, damage: 1, budget: 1, coins: 1, experience: 1, loot: 1, level: 0 },
  hard: { name: '困难', health: 1.3, damage: 1.15, budget: 1.1, coins: 1.25, experience: 1.1, loot: 1.1, level: 1 },
  nightmare: { name: '噩梦', health: 1.7, damage: 1.35, budget: 1.2, coins: 1.6, experience: 1.2, loot: 1.2, level: 2 }
};

export function hellRewardMultiplier(floor: number): number {
  if (floor <= 0) return 1;
  const bounded = Math.min(20, floor); const milestone = Math.floor(bounded / 5);
  return 1.5 + milestone * .5;
}

export function expeditionFloor(config: SimConfig, round: number): number {
  return config.expedition ? Math.max(0, round - config.expedition.stages) : 0;
}

export function expeditionWave(config: SimConfig, round: number): WaveDefinition | undefined {
  const waves = config.waves ?? [];
  if (!config.expedition) {
    const index = config.cycleWaves ? (round - 1) % waves.length : Math.min(round - 1, waves.length - 1);
    return waves[index];
  }
  const floor = expeditionFloor(config, round);
  if (!floor) return waves[round - 1];
  const positions = [6, 7, 11, 12, 19]; const position = (floor - 1) % 5;
  const source = waves[positions[position]]; if (!source) return;
  const ratio = config.expedition.hellSeconds / source.interval;
  const composition = source.composition ? { ...source.composition, budget: source.composition.budget * ratio, recovery: 10 } : undefined;
  const scaledCount = Math.ceil(source.count * ratio); const count = Math.max(1, scaledCount);
  return { ...source, name: `地狱${floor}层 · ${source.name ?? '围猎'}`, interval: config.expedition.hellSeconds, count, composition };
}

export function expeditionBudget(config: SimConfig, round: number): number {
  const setting = expeditionDifficulties[config.difficulty ?? 'normal']; const floor = expeditionFloor(config, round);
  if (!floor) return setting.budget;
  const growth = Math.min(1.5, 1 + floor * .025);
  return setting.budget * growth;
}

export function expeditionCoinMultiplier(config: SimConfig, round: number): number {
  const setting = expeditionDifficulties[config.difficulty ?? 'normal']; const floor = expeditionFloor(config, round);
  const reward = hellRewardMultiplier(floor); return setting.coins * reward;
}

export function expeditionBaseReward(round: number): number {
  return round > 20 ? 20 : round === 20 ? 110 : 10;
}

export function expeditionCleared(sim: Simulation): boolean {
  if (!sim.config.expedition || sim.round <= sim.config.expedition.stages || sim.elapsed <= 0) return false;
  const scheduled = sim.waveSchedules.some(schedule => schedule.remaining > 0);
  const enemies = sim.enemies.some(enemy => enemy.hp > 0 && enemy.definition.behavior !== 'squirrel');
  const eggs = sim.hazards.some(hazard => hazard.kind === 'egg');
  return !scheduled && !sim.waveQueue.length && !enemies && !eggs;
}

export function clearExpeditionCombat(sim: Simulation): void {
  sim.enemies = []; sim.waveQueue = []; sim.waveSchedules = []; sim.hazards = []; sim.poisonWait = {};
  sim.projectiles = []; sim.effects = []; sim.castHits = {}; sim.preparing = true;
  for (const player of sim.players) { player.dashLeft = 0; player.blocking = false; player.banners = undefined; }
}
