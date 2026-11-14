import { enemyAbilities } from './enemy-abilities';
import { prepareComposition, recordCompositionSpawn, waveCycleLength, waveSpawnCountMultiplier } from './wave-composition';
import { expeditionDifficulties, expeditionFloor, expeditionWave } from './expedition';
import type { CompositionBatch } from './wave-composition';
import type { Arena, Enemy, EnemyDefinition, Simulation, SimConfig, Vec, WaveDefinition } from './index';

export interface WaveMix { behavior: string; weight: number }
export interface SpawnGroup { start: number; end: number; interval: number; minimumInterval?: number; acceleration?: number; min: number; max: number; behaviors: string[]; mode: 'scattered' | 'edge' | 'special'; rank?: 'normal' | 'elite' | 'boss'; priority?: boolean; repeats?: number }
export interface WaveSchedule { batch?: CompositionBatch; group: SpawnGroup; next: number; interval: number; remaining: number }
export interface WaveEntry { scripted?: boolean; tier?: number; formation?: boolean; depth?: number; definition: EnemyDefinition; point?: Vec; at: number; wave: number; priority: boolean; healthScale: number; damageScale: number; group: number; expires: number; duration: number; anchor: string; angle: number; mode: SpawnGroup['mode'] }
export interface SpawnWarning extends Vec { wave: number; kind: string; count: number; seconds: number; duration: number }
export interface WaveActions { legal: (arena: Arena, point: Vec, radius: number) => boolean }
export interface WaveProfile { wave: WaveDefinition; stage: number; position: number; elite: number; boss: number; hp: number; damage: number; count: number; mix: WaveMix[] }
const mechanisms = ['sower', 'protector', 'brood', 'moth'];

export function waveProfile(sim: { config: SimConfig }, round: number): WaveProfile {
  const waves = sim.config.waves ?? [];
  const length = waveCycleLength(sim.config);
  const position = (round - 1) % length + 1; const stage = Math.floor((round - 1) / length) + 1;
  const index = sim.config.cycleWaves ? position - 1 : Math.min(round - 1, waves.length - 1);
  const wave = expeditionWave(sim.config, round) ?? waves[index] ?? { interval: sim.config.roundDuration, count: 12, kinds: ['normal'] };
  if (wave.composition) {
    const setting = expeditionDifficulties[sim.config.difficulty ?? 'normal'];
    const floor = expeditionFloor(sim.config, round); const progress = floor ? (sim.config.expedition?.stages ?? 20) : round;
    const hp = (1 + .1 * (progress - 1)) * setting.health * 1.12 ** floor;
    const damage = (1 + .04 * (progress - 1)) * setting.damage * 1.05 ** floor;
    return { wave, stage, position, elite: 0, boss: 0, hp, damage, count: 1, mix: [] };
  }
  const later = stage - 1;
  let elite = wave.eliteChance ?? 0; let boss = wave.bossChance ?? 0;
  const quiet = [1, 3, 6, 8].includes(position);
  const eliteStep = quiet ? .01 : position === 5 || position === 10 ? .03 : .02;
  const eliteCap = quiet ? .08 : position === 5 ? .30 : position === 10 ? .35 : .22;
  elite = Math.min(eliteCap, elite + later * eliteStep);
  if (boss > 0) { const increase = position === 10 ? .005 : .0025; const cap = position === 10 ? .05 : .03; boss = Math.min(cap, boss + later * increase); }
  const tier = Math.min(stage, 4) - 1; const depth = Math.max(0, stage - 4);
  const hp = [1, 1.3, 1.7, 2.2][tier] * 1.2 ** depth * (1 + (position - 1) * .01);
  const damage = [1, 1.1, 1.22, 1.35][tier] * 1.08 ** depth;
  const count = Math.min(1.4, 1 + later * .1);
  const theme = stage <= 4 ? stage - 1 : 1 + (stage - 5) % 3;
  const mix = wave.stageMixes?.[theme] ?? wave.mix ?? [];
  return { wave, stage, position, elite, boss, hp, damage, count, mix };
}

export function planWave(sim: Simulation): void {
  if (sim.presentationOnly) return;
  sim.spawnWait = sim.clock;
  const profile = waveProfile(sim, sim.round);
  if (profile.wave.composition) { planCompositionEntries(sim); return; }
  const fallback: SpawnGroup = { start: 1, end: profile.wave.interval - 2, interval: 4, min: 3, max: 5, behaviors: profile.wave.kinds, mode: 'scattered' };
  const groups = [...(profile.wave.groups ?? [fallback])];
  if (profile.wave.squirrels) {
    const rank = profile.stage >= 3 && profile.stage % 2 === 1 ? 'boss' : profile.stage >= 2 ? 'elite' : 'normal';
    groups.push({ start: 8, end: 8, interval: 1, min: 1, max: 1, behaviors: ['squirrel'], mode: 'special', rank, repeats: 1 });
  }
  sim.waveSchedules = groups.map(group => ({ group, next: group.start, interval: group.interval, remaining: group.repeats ?? 1000 }));
  sim.waveQueue = []; sim.spawnHistory = []; sim.waveBossPlanned = false; sim.spawnIssued = 0;
}

function planCompositionEntries(sim: Simulation): void {
  const plan = prepareComposition(sim);
  sim.waveSchedules = []; sim.waveQueue = []; sim.spawnHistory = []; sim.spawnIssued = 0; sim.waveBossPlanned = false;
  if (!plan) return;
  for (const batch of plan.batches) {
    const definition = sim.config.enemies.find(enemy => enemy.kind === batch.kind);
    if (!definition) continue;
    const group: SpawnGroup = { start: batch.at, end: batch.at, interval: 1, min: batch.count, max: batch.count, behaviors: [definition.behavior ?? 'tree'], mode: batch.mode, priority: batch.priority, repeats: 1 };
    sim.waveSchedules.push({ batch, group, next: batch.at, interval: 1, remaining: 1 });
  }
}

function scheduleComposition(sim: Simulation): void {
  const profile = waveProfile(sim, sim.round);
  const plan = sim.waveDirector?.current;
  if (!plan) return;
  const living = sim.players.filter(player => player.hp > 0);
  living.sort((first, second) => first.id.localeCompare(second.id));
  for (const [group, schedule] of sim.waveSchedules.entries()) {
    const batch = schedule.batch;
    if (!batch || schedule.remaining === 0 || sim.elapsed < batch.at) continue;
    schedule.remaining = 0;
    const base = sim.config.enemies.find(enemy => enemy.kind === batch.kind);
    const anchorIndex = (batch.sector + sim.round - 1) % Math.max(1, living.length);
    const anchor = living[anchorIndex]?.id ?? '';
    if (!base || !anchor) continue;
    const factor = base.rank === 'boss' ? .55 : base.rank === 'elite' ? .08 : .025;
    const behavior = base.behavior;
    const roleGrowth = behavior === 'tree' || behavior === 'wolf' ? .75 : mechanisms.includes(behavior ?? '') ? .85 : 1;
    const healthGrowth = base.rank === 'normal' ? 1 + (profile.hp - 1) * roleGrowth : profile.hp;
    const healthScale = healthGrowth * (1 + (sim.partySize - 1) * factor) * (profile.wave.healthMultiplier ?? 1);
    const damageScale = profile.damage * (1 + (sim.partySize - 1) * .01) * (profile.wave.damageMultiplier ?? 1);
    const definition = { ...base, hp: base.hp * healthScale, damage: base.damage * damageScale };
    const duration = base.rank === 'boss' || base.rank === 'elite' ? 2 : 1;
    const formation = profile.wave.composition?.pattern === 'formation';
    const support = behavior === 'archer' || behavior === 'protector' || behavior === 'brood' || behavior === 'moth' || behavior === 'sower';
    const depth = formation && support ? 2 : 0;
    const count = batch.count;
    for (let offset = 0; offset < count; offset += 1) {
      const at = sim.clock + offset * .12 / waveSpawnCountMultiplier;
      const angle = batch.angle + (offset - (count - 1) / 2) * .12;
      const expires = sim.clock + plan.duration - sim.elapsed;
      sim.waveQueue.push({ scripted: true, tier: batch.tier, formation, depth, definition, at, wave: sim.round, priority: batch.priority && offset === 0, healthScale, damageScale, group, expires, duration, anchor, angle, mode: batch.mode });
      sim.spawnIssued += 1;
    }
    if (base.rank === 'boss' && behavior !== 'squirrel') sim.waveBossPlanned = true;
  }
}

export function waveSpawningComplete(sim: Simulation): boolean {
  const profile = waveProfile(sim, sim.round);
  const scheduled = sim.waveSchedules.some(item => item.remaining > 0 && item.next <= item.group.end);
  return sim.elapsed >= profile.wave.interval && !scheduled && sim.waveQueue.length === 0;
}

function chooseDefinition(sim: Simulation, data: { group: SpawnGroup; profile: WaveProfile }): EnemyDefinition | undefined {
  const { group, profile } = data;
  let mix = profile.mix.filter(item => group.behaviors.includes(item.behavior));
  if (!mix.length && group.priority) mix = profile.mix.filter(item => !mechanisms.includes(item.behavior));
  if (profile.mix.length && !mix.length && !group.behaviors.includes('squirrel')) return;
  const pool = mix.length ? mix : group.behaviors.map(behavior => ({ behavior, weight: 1 }));
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  let roll = sim.random() * total; let behavior = pool[0]?.behavior;
  for (const item of pool) { roll -= item.weight; if (roll < 0) { behavior = item.behavior; break; } }
  if (!behavior) return;
  let rank = group.rank ?? 'normal';
  if (!group.rank && behavior !== 'squirrel') {
    const chance = sim.random();
    const reserved = profile.wave.guarantee === 'boss';
    if (!reserved && !sim.waveBossPlanned && chance < profile.boss) rank = 'boss';
    else if (chance < profile.boss + profile.elite) rank = 'elite';
  }
  if (rank === 'boss' && behavior !== 'squirrel') {
    if (sim.waveBossPlanned) return;
    const pools = profile.wave.bossPools ?? sim.config.waves?.[9]?.bossPools;
    const stageIndex = Math.min(profile.stage - 1, (pools?.length ?? 1) - 1);
    const available = pools?.[stageIndex];
    if (available?.length) { const roll = sim.random(); const index = Math.floor(roll * available.length); behavior = available[index]; }
  }
  const kind = `${behavior}-${rank}`;
  const definition = sim.config.enemies.find(item => item.kind === kind || item.kind === behavior);
  if (definition?.rank === 'boss' && behavior !== 'squirrel') sim.waveBossPlanned = true;
  return definition;
}

function scheduleGroups(sim: Simulation): void {
  const profile = waveProfile(sim, sim.round);
  if (profile.wave.composition) { scheduleComposition(sim); return; }
  for (const [index, schedule] of sim.waveSchedules.entries()) {
    const group = schedule.group;
    if (schedule.remaining <= 0 || schedule.next > group.end || sim.elapsed < schedule.next) continue;
    schedule.remaining -= 1;
    const reduced = schedule.interval - (group.acceleration ?? 0);
    schedule.interval = Math.max(group.minimumInterval ?? group.interval, reduced);
    schedule.next += schedule.interval;
    const living = sim.players.filter(player => player.hp > 0); if (!living.length) return;
    const targetRoll = sim.random(); const targetIndex = Math.floor(targetRoll * living.length); const anchor = living[targetIndex].id;
    const angleRoll = sim.random(); const angle = angleRoll * Math.PI * 2;
    const countRoll = sim.random(); const base = group.min + Math.floor(countRoll * (group.max - group.min + 1));
    const special = group.rank === 'boss' || group.rank === 'elite' || group.behaviors.some(behavior => mechanisms.includes(behavior));
    const population = special ? 1 : 1 + (sim.partySize - 1) * .3;
    const count = Math.ceil(base * population * (special ? 1 : profile.count));
    for (let offset = 0; offset < count; offset += 1) {
      const data = { group, profile }; const baseEnemy = chooseDefinition(sim, data); if (!baseEnemy) continue;
      const factor = baseEnemy.rank === 'boss' ? .55 : baseEnemy.rank === 'elite' ? .08 : .025;
      const healthScale = profile.hp * (1 + (sim.partySize - 1) * factor) * (profile.wave.healthMultiplier ?? 1);
      const damageScale = profile.damage * (1 + (sim.partySize - 1) * .01) * (profile.wave.damageMultiplier ?? 1);
      const definition = { ...baseEnemy, hp: baseEnemy.hp * healthScale, damage: baseEnemy.damage * damageScale };
      const duration = baseEnemy.rank === 'boss' || baseEnemy.rank === 'elite' ? 2 : group.mode === 'edge' ? 1.5 : 1;
      const priority = group.priority ?? false;
      const expires = sim.clock + profile.wave.interval - sim.elapsed;
      const entry: WaveEntry = { definition, at: sim.clock + offset * .08, wave: sim.round, priority, healthScale, damageScale, group: index, expires, duration, anchor, angle, mode: group.mode };
      sim.waveQueue.push(entry); sim.spawnIssued += 1;
    }
  }
}

function separationSquared(first: Vec, second: Vec): number {
  const dx = first.x - second.x; const dy = first.y - second.y;
  return dx * dx + dy * dy;
}

function safePoint(sim: Simulation, entry: WaveEntry, actions: WaveActions): boolean {
  const point = entry.point; if (!point) return false;
  const valid = actions.legal(sim.arena, point, entry.definition.radius); if (!valid) return false;
  for (const player of sim.players) {
    if (player.hp <= 0) continue;
    const distance = separationSquared(point, player);
    const clearance = Math.max(3, entry.definition.radius + .9);
    if (distance < clearance * clearance) return false;
  }
  return true;
}

function selectPoint(sim: Simulation, entry: WaveEntry, actions: WaveActions): Vec | undefined {
  const living = sim.players.filter(player => player.hp > 0);
  const anchor = living.find(player => player.id === entry.anchor) ?? living[0]; if (!anchor) return;
  let best: Vec | undefined; let bestScore = -Infinity;
  const margin = entry.definition.radius + 2;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const angleRoll = sim.random(); const radiusRoll = sim.random();
    const spread = entry.formation ? .2 : .8;
    const angle = entry.angle + (angleRoll - .5) * Math.PI * spread;
    const radius = entry.formation ? 4 + (entry.depth ?? 0) + radiusRoll : 4 + radiusRoll * 3;
    let x = anchor.x + Math.cos(angle) * radius;
    let y = anchor.y + Math.sin(angle) * radius;
    if (entry.mode === 'edge') {
      const dx = Math.cos(angle); const dy = Math.sin(angle);
      const horizontal = dx === 0 ? Infinity : (dx > 0 ? sim.arena.width - margin - anchor.x : margin - anchor.x) / dx;
      const vertical = dy === 0 ? Infinity : (dy > 0 ? sim.arena.height - margin - anchor.y : margin - anchor.y) / dy;
      const distance = Math.min(horizontal, vertical);
      x = anchor.x + dx * distance; y = anchor.y + dy * distance;
    }
    const point = { x, y }; const candidate = { ...entry, point };
    if (x < margin - .001 || y < margin - .001 || x > sim.arena.width - margin + .001 || y > sim.arena.height - margin + .001) continue;
    const safe = safePoint(sim, candidate, actions); if (!safe) continue;
    let crowded = false;
    for (const other of sim.waveQueue) {
      if (other === entry || !other.point) continue;
      const squared = separationSquared(point, other.point); const gap = entry.definition.radius + other.definition.radius + .3;
      if (squared < gap * gap) { crowded = true; break; }
    }
    if (crowded) continue;
    for (const enemy of sim.enemies) {
      if (enemy.hp <= 0) continue;
      const squared = separationSquared(point, enemy); const gap = entry.definition.radius + enemy.radius + .3;
      if (squared < gap * gap) { crowded = true; break; }
    }
    if (crowded) continue;
    let score = 0;
    for (const recent of sim.spawnHistory) {
      const distance = separationSquared(point, recent); if (distance < 9) score -= 9 - distance;
    }
    if (score > bestScore) { bestScore = score; best = point; }
  }
  return best;
}

export function spawnWaveBatch(sim: Simulation, actions: WaveActions): void {
  if (sim.presentationOnly) return;
  scheduleGroups(sim);
  const retained: WaveEntry[] = [];
  for (const entry of sim.waveQueue) {
    if (sim.clock >= entry.expires) continue;
    if (entry.at > sim.clock) { retained.push(entry); continue; }
    // 只在首次选点时避开玩家；预警开始后固定坐标和出生时间。
    if (!entry.point) {
      entry.point = selectPoint(sim, entry, actions);
      entry.at = sim.clock + (entry.point ? entry.duration : .5);
      if (!entry.point) entry.angle += Math.PI * .7;
      else {
        sim.spawnHistory.push(entry.point);
        if (sim.spawnHistory.length > 32) sim.spawnHistory.shift();
      }
      retained.push(entry); continue;
    }
    const point = entry.point; if (!point) { retained.push(entry); continue; }
    if (sim.clock < sim.spawnWait) { retained.push(entry); continue; }
    sim.nextId += 1; const base = entry.definition;
    const enemy: Enemy = { bornWave: entry.wave, id: `enemy-${sim.nextId}`, ...point, radius: base.radius, hp: base.hp, maxHp: base.hp, kind: base.kind, state: 'seek', facingX: 0, facingY: 1, timer: 0, targetId: '', definition: base, healthScale: entry.healthScale, damageScale: entry.damageScale };
    const ability = enemyAbilities(enemy);
    if (entry.tier !== undefined) ability.tier = entry.tier;
    else if (base.rank === 'normal' && base.behavior !== 'squirrel' && sim.nextId % 3 !== 0) ability.tier = 0;
    if (entry.scripted) recordCompositionSpawn(sim, base);
    sim.enemies.push(enemy); sim.spawned += 1;
    const spawnInterval = base.rank === 'boss' ? .35 : base.rank === 'elite' ? .25 : .15;
    const multiplier = entry.scripted ? waveSpawnCountMultiplier : 1;
    sim.spawnWait = sim.clock + spawnInterval / multiplier;
  }
  sim.waveQueue = retained;
}

export function waveWarnings(sim: Simulation): SpawnWarning[] {
  const warnings: SpawnWarning[] = [];
  for (const entry of sim.waveQueue) {
    if (!entry.point) continue;
    const seconds = Math.max(0, entry.at - sim.clock);
    const special = entry.definition.rank === 'boss' || entry.definition.rank === 'elite';
    const warning = { ...entry.point, wave: entry.wave, kind: special ? entry.definition.kind : '', count: 1, seconds, duration: entry.duration };
    warnings.push(warning);
  }
  return warnings;
}
