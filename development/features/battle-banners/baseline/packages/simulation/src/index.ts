import { castNovel, stepNovel } from './novel-skills';
import type { NovelFields } from './novel-skills';
import { abilityProgress, attackInterval, castModifiers, prepareRhythm, commitCast, heartConversion } from './combat-rhythm';
import type { AbilityProgress, HeartProgress } from './combat-rhythm';
export * from './combat-rhythm';
export * from './ability-growth';
import { addGrowthField, aftershock, evolveImpact, returnProjectile, stepEvolution, transferDeathMarks } from './skill-evolution';
import type { EvolutionShot, EvolutionEffect } from './skill-evolution';
import { planWave, spawnWaveBatch, waveProfile } from './waves';
import type { SpawnGroup, WaveSchedule } from './waves';
import type { WaveMix, WaveEntry } from './waves';
export * from './waves';
import { updateResonance, consumeResonance, recordAbilityHit, resonanceState } from './resonance';
import type { ResonanceState, ThunderMark } from './resonance';
import { protectedBy, stepEnemyHazards, stepEnemyTactic } from './enemy-tactics';
import type { EnemyActions, EnemyHazard } from './enemy-tactics';
export type { EnemyHazard } from './enemy-tactics';
import { defaultEquipment, equipmentRuntime } from './equipment';
import type { EquipmentLoadout, EquipmentSupport, EquipmentItem } from './equipment';
export * from './equipment';
export * from './build-growth';
export * from './character-growth';
import { awardCombatGrowth } from './build-growth';
import type { BuildItem } from './equipment';
import type { GrowthChoice } from './build-growth';
import { calculateCharacterStats } from './characters';
import type { CharacterBuild, CharacterStats } from './characters';
export * from './characters';
export * from './survival';
export interface Vec { x: number; y: number }
export interface Obstacle extends Vec { width: number; height: number }
export interface EnemyDefinition { kind: string; name?: string; behavior?: string; rank?: string; hp: number; speed: number; radius: number; damage: number; windup: number; recovery: number; reach: number }
export interface WaveDefinition { groups?: SpawnGroup[]; interval: number; count: number; kinds: string[]; name?: string; hint?: string; mix?: WaveMix[]; stageMixes?: WaveMix[][]; eliteChance?: number; bossChance?: number; guarantee?: 'none' | 'elite' | 'boss'; healthMultiplier?: number; damageMultiplier?: number; squirrels?: boolean }
export interface SimConfig { cycleWaves?: boolean; equipmentDefinitions?: EquipmentItem[]; waves?: WaveDefinition[]; revivalSeconds?: number; supportDefinitions?: EquipmentSupport[]; roundDuration: number; maxAlive: number; maxSpawned: number; character: { points: { power: number; magic: number; vitality: number; spirit: number; movement: number; haste: number; luck?: number } }; heart: { capacity: number; interval: number; recovery: number; manaCost: number; slots?: number }; weapon: { interval: number; cost: number; coefficient: number; speed: number; range: number; supportSlots?: number }; skill: { interval: number; cost: number; coefficient: number; range: number; supportSlots?: number }; support: { host?: string; costMultiplier: number; damageMultiplier: number }; enemies: EnemyDefinition[] }
export interface Motion extends Vec { facingX: number; facingY: number }
export interface Controls extends Vec { sequence: number; block: boolean; dash: boolean; position?: Motion }
export interface AbilityState { progress?: AbilityProgress; itemId: string; remaining: number; count: number; state: string }
export interface Player extends Vec { heartProgress?: HeartProgress; growthNotices?: string[]; contactNextAt?: number; fusionNotices?: string[]; hasteLeft: number; focusLeft: number; shieldLeft: number; lootShield: number; baseStats: CharacterStats; characterRanks: Record<string, number>; manaRecovery: number; resonance?: ResonanceState; companionGranted?: boolean; companionMilestones?: number[]; buildItems: BuildItem[]; buildRevision: number; level: number; experience: number; upgradeCredits: number; waveCredits: number; choiceSequence: number; choices: GrowthChoice[]; abilityStates: AbilityState[]; loadout: EquipmentLoadout; equipment: ReturnType<typeof equipmentRuntime>; stats: CharacterStats; id: string; name: string; facingX: number; facingY: number; hp: number; maxHp: number; mp: number; maxMp: number; energy: number; capacity: number; weaponWait: number; skillWait: number; weaponState: string; skillState: string; dashCooldown: number; blocking: boolean; connected: boolean; ready: boolean; growth: ('power' | 'energy' | 'vitality')[]; kills: number; damage: number; blocked: number; input: Controls; inputAt: number; dashLeft: number; dashX: number; dashY: number; heartWait: number; sequence: number; weaponCount: number; skillCount: number; clientDriven: boolean; survivalSeconds: number; reviveRemaining: number; assists: number }
export interface Enemy extends Vec { thunderResiduals?: Record<string, number>; strongFrostAt?: Record<string, number>; frostMarks?: Record<string, number>; frostCasts?: Record<string, string>; burnUntil?: Record<string, number>; bornWave?: number; healthScale?: number; damageScale?: number; thunderMarks?: Record<string, ThunderMark>; slowUntil?: number; slowFactor?: number; knockbackAt?: number; id: string; kind: string; radius: number; hp: number; maxHp: number; state: string; facingX: number; facingY: number; timer: number; targetId: string; definition: EnemyDefinition; contributors?: Record<string, number>; attackX?: number; attackY?: number; originX?: number; originY?: number; attackCount?: number; combo?: number; hitIds?: string[]; killerId?: string; linkId?: string; linkWait?: number; parentId?: string; summonCount?: number; escapeLeft?: number }
export interface Projectile extends Vec, EvolutionShot { sourceId?: string; resonance?: number; empowered?: boolean; markDuration?: number; id: string; owner: string; vx: number; vy: number; ttl: number; damage: number; hostile?: boolean; effect?: string; castId?: string; targetId?: string; pierces?: number; hitIds?: string[]; blast?: number; slow?: number; slowDuration?: number; bounce?: boolean }
export interface Effect extends Vec, EvolutionEffect, NovelFields { charged?: boolean; targetId?: string; targetKind?: 'player' | 'enemy'; damage?: number; absorbed?: number; killed?: boolean; flavor?: string; castId?: string; level?: number; swing?: number; angle?: number; width?: number; owner?: string; empowered?: boolean; id: string; radius: number; kind: string; ttl: number; duration?: number; facingX?: number; facingY?: number }
export interface Arena { width: number; height: number; spawns: Vec[]; enemySpawns: Vec[]; obstacles: Obstacle[] }
export interface Simulation { waveSchedules: WaveSchedule[]; spawnHistory: Vec[]; waveBossPlanned: boolean; spawnIssued: number; preparing?: boolean; defeated: Enemy[]; waveQueue: WaveEntry[]; hazards: EnemyHazard[]; poisonWait: Record<string, number>; config: SimConfig; arena: Arena; players: Player[]; enemies: Enemy[]; projectiles: Projectile[]; effects: Effect[]; elapsed: number; clock: number; spawnWait: number; spawned: number; nextId: number; round: number; random: () => number; finished: boolean; success: boolean; presentationOnly: boolean; partySize: number; castHits: Record<string, { ids: string[]; until: number }> }

export function makePlayer(identity: { id: string; name: string }, config: SimConfig): Player {
  const points = config.character.points;
  const build = { points: { ...points, luck: points.luck ?? 0 }, talents: [] };
  const stats = calculateCharacterStats(build);
  const maxHp = stats.maxHp; const maxMp = stats.maxMp;
  const loadout = defaultEquipment(config);
  const equipment = equipmentRuntime(loadout, config);
  return { ...identity, hasteLeft: 0, focusLeft: 0, shieldLeft: 0, lootShield: 0, baseStats: { ...stats }, characterRanks: {}, manaRecovery: 5, buildItems: [], buildRevision: 0, level: 1, experience: 0, upgradeCredits: 0, waveCredits: 0, choiceSequence: 0, choices: [], abilityStates: [], loadout, equipment, stats, x: 15, y: 11, facingX: 0, facingY: 1, hp: maxHp, maxHp, mp: maxMp, maxMp, energy: config.heart.capacity, capacity: config.heart.capacity, weaponWait: 0, skillWait: 0, weaponState: '就绪', skillState: '就绪', dashCooldown: 0, blocking: false, connected: true, ready: false, growth: [], kills: 0, damage: 0, blocked: 0, input: { sequence: 0, x: 0, y: 0, block: false, dash: false }, inputAt: 0, dashLeft: 0, dashX: 0, dashY: 1, heartWait: config.heart.interval, sequence: -1, weaponCount: 0, skillCount: 0, clientDriven: false, survivalSeconds: 0, reviveRemaining: 0, assists: 0 };
}

export function applyEquipment(player: Player, data: { loadout: EquipmentLoadout; config: SimConfig }): void {
  player.loadout = data.loadout;
  player.equipment = equipmentRuntime(data.loadout, data.config);
  player.abilityStates = [];
  player.capacity = player.equipment.heartItem?.capacity ?? 0;
  player.energy = player.capacity;
  player.weaponWait = 0; player.skillWait = 0; player.heartWait = player.equipment.heartItem?.interval ?? data.config.heart.interval;
}

export function applyCharacterBuild(player: Player, build: CharacterBuild): void {
  const stats = calculateCharacterStats(build);
  player.baseStats = { ...stats }; player.stats = stats; player.maxHp = stats.maxHp; player.hp = stats.maxHp; player.maxMp = stats.maxMp; player.mp = stats.maxMp;
}

export function createSimulation(options: { config: SimConfig; arena: Arena; random: () => number }): Simulation {
  return { ...options, waveSchedules: [], spawnHistory: [], waveBossPlanned: false, spawnIssued: 0, defeated: [], waveQueue: [], hazards: [], poisonWait: {}, players: [], enemies: [], projectiles: [], effects: [], elapsed: 0, clock: 0, spawnWait: 0, spawned: 0, nextId: 0, round: 1, finished: false, success: false, presentationOnly: false, partySize: 1, castHits: {} };
}

export function waveDefinition(sim: Simulation): WaveDefinition {
  const profile = waveProfile(sim, sim.round);
  return profile.wave;
}

export function beginRound(sim: Simulation, round: number): void {
  sim.preparing = false; sim.round = round; sim.elapsed = 0; sim.spawned = 0; sim.finished = false; sim.success = false;
  if (round === 1) {
    sim.partySize = sim.players.length;
    sim.players.forEach((player, index) => {
      const spawn = sim.arena.spawns[index % sim.arena.spawns.length];
      player.survivalSeconds = 0; player.x = spawn.x; player.y = spawn.y;
      player.blocking = false; player.dashLeft = 0;
    });
  }
  planWave(sim);
}

export function revivePlayer(sim: Simulation, player: Player): void {
  if (sim.finished || player.hp > 0 || player.reviveRemaining > 0 || !player.connected) return;
  const living = sim.players.some(item => item.hp > 0);
  if (!living) return;
  player.hp = player.maxHp; player.mp = player.maxMp; player.energy = player.capacity;
  for (const ability of player.abilityStates) ability.remaining = 0;
  player.weaponWait = 0; player.skillWait = 0; player.dashLeft = 0; player.blocking = false;
}

export function recoverInHall(sim: Simulation): void {
  sim.enemies = []; sim.projectiles = []; sim.effects = []; sim.hazards = []; sim.poisonWait = {};
  for (const player of sim.players) {
    player.hp = player.maxHp; player.mp = player.maxMp; player.energy = player.capacity;
    player.weaponWait = 0; player.skillWait = 0; player.heartWait = player.equipment.heartItem?.interval ?? sim.config.heart.interval;
    for (const ability of player.abilityStates) ability.remaining = 0; player.dashCooldown = 0;
    player.blocking = false; player.dashLeft = 0;
  }
}

export function setInput(sim: Simulation, data: { id: string; input: Controls }): void {
  const player = sim.players.find(item => item.id === data.id);
  if (!player || data.input.sequence <= player.sequence) return;
  player.sequence = data.input.sequence; player.input = data.input; player.inputAt = sim.clock;
  const position = data.input.position;
  if (position) {
    const valid = legal(sim.arena, position, 0.4);
    if (valid) { player.x = position.x; player.y = position.y; player.facingX = position.facingX; player.facingY = position.facingY; player.clientDriven = true; }
  }
}

function length(vector: Vec): number { const squared = vector.x * vector.x + vector.y * vector.y; return Math.sqrt(squared); }
function unit(vector: Vec): Vec { const distance = length(vector); if (distance === 0) return { x: 0, y: 0 }; return { x: vector.x / distance, y: vector.y / distance }; }
function distance(a: Vec, b: Vec): number { const delta = { x: a.x - b.x, y: a.y - b.y }; return length(delta); }
function clamp(value: number, min: number, max: number): number { const upperBounded = Math.min(max, value); return Math.max(min, upperBounded); }
function legal(arena: Arena, position: Vec, radius: number): boolean {
  if (position.x < radius || position.y < radius || position.x > arena.width - radius || position.y > arena.height - radius) return false;
  for (const rect of arena.obstacles) {
    const x = clamp(position.x, rect.x, rect.x + rect.width); const y = clamp(position.y, rect.y, rect.y + rect.height);
    const delta = { x: position.x - x, y: position.y - y }; const separation = length(delta);
    if (separation < radius) return false;
  }
  return true;
}
function move(sim: Simulation, entity: Vec, movement: { x: number; y: number; radius: number }): void {
  const horizontal = { x: entity.x + movement.x, y: entity.y }; const vertical = { x: entity.x, y: entity.y + movement.y };
  const canX = legal(sim.arena, horizontal, movement.radius); if (canX) entity.x = horizontal.x;
  vertical.x = entity.x; const canY = legal(sim.arena, vertical, movement.radius); if (canY) entity.y = vertical.y;
}
function addEffect(sim: Simulation, effect: { targetId?: string; targetKind?: 'player' | 'enemy'; damage?: number; absorbed?: number; killed?: boolean; flavor?: string; castId?: string; level?: number; sourceId?: string; swing?: number; angle?: number; width?: number; owner?: string; empowered?: boolean; x: number; y: number; radius: number; kind: string; id?: string; duration?: number; facingX?: number; facingY?: number }): void {
  if (effect.id && sim.effects.some(item => item.id === effect.id)) return;
  sim.nextId += 1; const id = effect.id ?? `fx-${sim.nextId}`; const ttl = effect.duration ?? 0.3; sim.effects.push({ ...effect, id, ttl });
}
function hurtEnemy(sim: Simulation, event: { enemy: Enemy; player?: Player; damage: number; source?: Vec; bypassShield?: boolean; flavor?: string; castId?: string }): void {
  if (event.enemy.hp <= 0 || event.enemy.state === 'detonating') return;
  if (sim.presentationOnly) return;
  const protector = protectedBy(sim, event.enemy);
  let damage = event.damage * (protector ? .4 : 1);
  const source = event.source ?? event.player;
  if (event.enemy.definition.behavior === 'shield' && source && !event.bypassShield) {
    const offset = { x: source.x - event.enemy.x, y: source.y - event.enemy.y }; const direction = unit(offset);
    const front = direction.x * event.enemy.facingX + direction.y * event.enemy.facingY >= 0.5;
    if (front) { damage *= 0.25; const effect = { x: event.enemy.x, y: event.enemy.y, radius: event.enemy.radius + .15, kind: 'shield-hit' }; addEffect(sim, effect); }
  }
  const actual = Math.min(event.enemy.hp, damage); event.enemy.hp -= actual;
  if (event.player) event.player.damage += actual;
  if (actual > 0 && event.player) {
    event.enemy.contributors ??= {};
    event.enemy.contributors[event.player.id] = sim.clock;
  }
  if (event.enemy.hp <= 0) {
    if (event.enemy.definition.behavior === 'bomb') {
      event.enemy.hp = 1; event.enemy.state = 'detonating'; event.enemy.timer = event.enemy.definition.windup;
      event.enemy.attackCount = (event.enemy.attackCount ?? 0) + 1; event.enemy.killerId = event.player?.id;
      return;
    }
    transferDeathMarks(sim, event.enemy);
    if (event.player) { event.player.kills += 1; awardCombatGrowth(sim, event.player, true); } event.enemy.state = 'dead';
    if (event.player && !event.enemy.parentId) sim.defeated.push(event.enemy);
    for (const player of sim.players) {
      const contribution = event.enemy.contributors?.[player.id];
      if (player.id !== event.player?.id && contribution !== undefined && sim.clock - contribution <= 15) { player.assists += 1; awardCombatGrowth(sim, player, false); }
    }
  }
  const offset = { x: event.enemy.x - (source?.x ?? event.enemy.x), y: event.enemy.y - (source?.y ?? event.enemy.y) }; const direction = unit(offset);
  const effect: Effect = { id: `impact-${sim.nextId + 1}`, ttl: .5, duration: .5, targetId: event.enemy.id, targetKind: 'enemy', owner: event.player?.id, damage: actual, killed: event.enemy.hp <= 0, flavor: event.flavor ?? 'impact', castId: event.castId, facingX: direction.x, facingY: direction.y, x: event.enemy.x, y: event.enemy.y, radius: event.enemy.radius, kind: 'hit' }; addEffect(sim, effect);
}
function nearest(sim: Simulation, origin: Vec, range: number): Enemy | undefined {
  let best: Enemy | undefined; let limit = range;
  for (const enemy of sim.enemies) { if (enemy.hp <= 0 || enemy.state === 'detonating' || enemy.state === 'escaped') continue; const separation = distance(enemy, origin); if (separation < limit) { best = enemy; limit = separation; } }
  return best;
}
function playerStep(sim: Simulation, player: Player, dt: number): void {
  updateResonance(player, dt);
  player.hasteLeft = Math.max(0, player.hasteLeft - dt); player.focusLeft = Math.max(0, player.focusLeft - dt);
  player.shieldLeft = Math.max(0, player.shieldLeft - dt); if (player.shieldLeft === 0) player.lootShield = 0;
  if (player.hp <= 0) {
    player.blocking = false; player.dashLeft = 0;
    player.weaponState = '灵魂状态'; player.skillState = '灵魂状态';
    player.reviveRemaining = Math.max(0, player.reviveRemaining - dt);
    const fresh = player.connected && sim.clock - player.inputAt <= 0.6;
    if (fresh && !player.clientDriven) {
      const direction = unit(player.input);
      const movement = { x: direction.x * player.stats.movementSpeed * dt, y: direction.y * player.stats.movementSpeed * dt, radius: 0.4 };
      move(sim, player, movement);
      if (direction.x !== 0 || direction.y !== 0) { player.facingX = direction.x; player.facingY = direction.y; }
    }
    player.input.dash = false;
    return;
  }
  const config = sim.config; const stats = player.stats; const speed = stats.movementSpeed * (player.hasteLeft > 0 ? 1.15 : 1);
  const fresh = player.connected && sim.clock - player.inputAt <= 0.6;
  const input = fresh ? player.input : { x: 0, y: 0, dash: false, block: false };
  const direction = unit(input);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  if (player.clientDriven) {
    player.dashLeft = Math.max(0, player.dashLeft - dt);
    if (input.dash && !input.block && player.dashCooldown === 0) { player.dashLeft = 0.2; player.dashCooldown = 3; player.dashX = player.facingX; player.dashY = player.facingY; }
    player.blocking = input.block && player.dashLeft <= 0;
  } else if (player.dashLeft > 0) {
    const duration = Math.min(dt, player.dashLeft); const movement = { x: player.dashX * 15 * duration, y: player.dashY * 15 * duration, radius: 0.4 };
    move(sim, player, movement); player.dashLeft -= duration; player.blocking = false;
  } else {
    player.blocking = input.block;
    if (!player.blocking) {
      if (direction.x !== 0 || direction.y !== 0) { player.facingX = direction.x; player.facingY = direction.y; }
      if (input.dash && player.dashCooldown === 0) { player.dashX = player.facingX; player.dashY = player.facingY; player.dashLeft = 0.2; player.dashCooldown = 3; }
      const movement = { x: direction.x * speed * dt, y: direction.y * speed * dt, radius: 0.4 }; move(sim, player, movement);
    }
  }
  player.input.dash = false;
  player.mp = Math.min(player.maxMp, player.mp + player.manaRecovery * dt);
  prepareRhythm(sim, player, dt);
  player.heartWait -= dt;
  const heart = player.equipment.heartItem;
  if (heart && player.heartWait <= 0) {
    const conversion = heartConversion(player); player.heartWait += conversion.interval;
    const bonus = player.growth.includes('energy') ? 1.25 : 1;
    const resonance = resonanceState(player);
    const extra = heart.effect === 'cycle' ? resonance.energyBoost : 0;
    const amount = Math.min(conversion.amount * bonus + extra, player.capacity - player.energy);
    const cost = amount / heart.recovery * heart.manaCost * (player.focusLeft > 0 ? .8 : 1);
    if (amount > 0 && player.mp >= cost) {
      player.mp -= cost; player.energy += amount;
      if (extra > 0) resonance.energyBoost = 0;
      if ((resonance.recoveryCharges ?? 0) > 0) resonance.recoveryCharges = (resonance.recoveryCharges ?? 0) - 1;
      const heartId = heart.definitionId ?? heart.id;
      const flavor = heart.effect === 'cycle' ? 'cycle' : heartId.endsWith('/spring') ? 'spring' : heartId.endsWith('/ocean') ? 'ocean' : 'stream';
      const stamp = sim.clock.toFixed(3);
      const effect = { level: heart.level ?? 1, empowered: extra > 0 || conversion.empowered, id: `recover-${player.id}-${stamp}`, owner: player.id, x: player.x, y: player.y, radius: 1, kind: `ability-recover-${flavor}`, duration: .65 };
      if (!sim.presentationOnly) addEffect(sim, effect);
    }
  }
  for (const kind of ['weapon', 'skill']) {
    for (const branch of player.equipment.branches) {
      if (branch.item.kind !== kind) continue;
      let state = player.abilityStates.find(item => item.itemId === branch.item.id);
      if (!state) { state = { itemId: branch.item.id, remaining: 0, count: 0, state: '就绪' }; player.abilityStates.push(state); }
      const event = { branch, state, dt };
      abilityStep(sim, player, event);
    }
  }
  const weapon = player.equipment.branches.find(branch => branch.item.kind === 'weapon');
  const skill = player.equipment.branches.find(branch => branch.item.kind === 'skill');
  const weaponState = player.abilityStates.find(item => item.itemId === weapon?.item.id);
  const skillState = player.abilityStates.find(item => item.itemId === skill?.item.id);
  player.weaponWait = weaponState?.remaining ?? 0; player.skillWait = skillState?.remaining ?? 0;
  player.weaponState = weaponState?.state ?? '未装备'; player.skillState = skillState?.state ?? '未装备';
}

function starTarget(sim: Simulation, data: { origin: Vec; direction: Vec; range: number; excluded: string[]; reserved: string[]; forwardOnly?: boolean }): Enemy | undefined {
  let selected: Enemy | undefined; let best = Infinity;
  for (const enemy of sim.enemies) {
    if (enemy.hp <= 0 || enemy.state === 'detonating' || enemy.state === 'escaped' || data.excluded.includes(enemy.id)) continue;
    const dx = enemy.x - data.origin.x; const dy = enemy.y - data.origin.y; const range = Math.hypot(dx, dy);
    if (range > data.range) continue;
    const alignment = range > 0 ? (dx * data.direction.x + dy * data.direction.y) / range : 1;
    if (data.forwardOnly && alignment < .25) continue;
    const score = (data.reserved.includes(enemy.id) ? 100 : 0) + (1 - alignment) * 3 + range * .1;
    if (score < best) { best = score; selected = enemy; }
  }
  return selected;
}
function guideStar(sim: Simulation, shot: Projectile, dt: number): void {
  const hits = sim.castHits[shot.castId ?? shot.id]?.ids ?? shot.hitIds ?? [];
  let target = sim.enemies.find(enemy => enemy.id === shot.targetId && enemy.hp > 0 && enemy.state !== 'detonating' && enemy.state !== 'escaped');
  const claimed = Boolean(shot.targetId && hits.includes(shot.targetId));
  if (claimed || !target && (shot.level ?? 1) >= 15) {
    const reserved = sim.projectiles.filter(other => other.id !== shot.id && other.castId === shot.castId && other.ttl > 0 && other.targetId).flatMap(other => other.targetId ? [other.targetId] : []);
    const direction = unit({ x: shot.vx, y: shot.vy });
    const search = { origin: shot, direction, range: 3, excluded: hits, reserved };
    target = starTarget(sim, search); shot.targetId = target?.id;
  }
  const speed = Math.hypot(shot.vx, shot.vy);
  const travelled = shot.travel ?? 0; shot.travel = travelled + speed * dt;
  if (!target || travelled < 1.4) return;
  const desired = Math.atan2(target.y - shot.y, target.x - shot.x); const current = Math.atan2(shot.vy, shot.vx);
  const difference = desired - current; const sine = Math.sin(difference); const cosine = Math.cos(difference);
  const shortest = Math.atan2(sine, cosine); const turn = clamp(shortest, -8 * dt, 8 * dt); const angle = current + turn;
  shot.vx = Math.cos(angle) * speed; shot.vy = Math.sin(angle) * speed;
}
function abilityStep(sim: Simulation, player: Player, event: { branch: Player['equipment']['branches'][number]; state: AbilityState; dt: number }): void {
  const { branch, state, dt } = event; const item = branch.item;
  state.remaining = Math.max(0, state.remaining - dt);
  const progress = abilityProgress(state);
  const level = item.level ?? 1; const evolved = level >= 5; const mastery = level >= 10;
  const baseRange = item.effect === 'spear' ? mastery ? 3.6 : evolved ? 3.3 : item.range ?? 3 : item.range ?? 0;
  const sweepReady = item.effect === 'slash' && level >= 15 && progress.landed >= 3;
  const range = item.kind === 'weapon' ? (baseRange + (sweepReady ? .35 : 0)) * branch.areaMultiplier : baseRange;
  const array = item.effect === 'sword-array' ? sim.effects.find(effect => effect.kind === 'ability-novel-array' && effect.owner === player.id && effect.sourceId === item.id && effect.ttl > 0) : undefined;
  const target = nearest(sim, array ?? player, array ? 5 : range);
  if (item.effect === 'star-beam' && sim.effects.some(effect => effect.kind === 'ability-novel-beam' && effect.owner === player.id && effect.sourceId === item.id && effect.ttl > 0)) { state.state = '持续施放'; return; }
  const modifiers = castModifiers(player, branch, state); const cost = modifiers.cost;
  if (target && state.remaining <= 0 && player.energy < cost) progress.starved += dt;
  if (target && state.remaining <= 0 && player.energy >= cost && progress.starved > 0 && !progress.released) {
    const rank = player.equipment.branches.indexOf(branch);
    state.remaining = Math.max(0, rank) * .04; progress.released = true;
  }
  state.state = player.blocking ? '格挡中' : state.remaining > 0 ? '计时中' : !target ? '无目标' : player.energy < cost ? '等待供能' : '就绪';
  if (!player.equipment.heart || state.state !== '就绪' || !target) return;
  const weapon = item.kind === 'weapon';
  const attack = weapon ? player.stats.physicalAttack : player.stats.magicalAttack;
  const empowered = consumeResonance(player, item.kind);
  const damage = (1 + empowered) * ((item.damage ?? 0) + attack * (item.coefficient ?? 0)) * branch.damageMultiplier * modifiers.damage;
  player.energy -= cost; state.remaining = attackInterval(player, branch, state); state.count += 1; state.state = '已触发';
  if (weapon) player.weaponCount += 1; else player.skillCount += 1;
  const id = `${player.id}-${item.id}-${state.count}`;
  const overloaded = modifiers.overloaded; progress.spent = modifiers.saved; commitCast(player, branch, state);
  if (overloaded) progress.overloadCast = state.count;
  const novel = { player, branch, target, damage, id, state, cost }; const novelActions = { hurt: hurtEnemy };
  if (castNovel(sim, novel, novelActions)) return;
  const delta = { x: target.x - player.x, y: target.y - player.y }; const aim = unit(delta);
  if (weapon) {
    const sweepWeapon = item.effect === 'slash' || item.effect === 'thunder-staff';
    const finisher = item.effect === 'dual' && evolved && (state.count - progress.origin) % (mastery ? 3 : 4) === 0;
    const angle = finisher ? mastery ? 120 : 90 : sweepWeapon && evolved ? mastery ? 180 : 150 : item.angle ?? 120;
    const threshold = Math.cos(angle * Math.PI / 360);
    const circle = evolved && item.effect === 'hammer' && (state.count - progress.origin) % (mastery ? 3 : 4) === 0 || item.effect === 'slash' && level >= 20 && sweepReady;
    const staffBoost = progress.staff > 0; progress.staff = 0;
    if (sweepReady) progress.landed = 0;
    let hitCount = 0; let marks = 0; let tipHit = false;
    const primary = { ids: [] as string[], until: sim.clock + 8 }; sim.castHits[id] = primary;
    let notified = false;
    for (const enemy of sim.enemies) {
      if (enemy.hp <= 0 || enemy.state === 'detonating' || enemy.state === 'escaped') continue;
      const offset = { x: enemy.x - player.x, y: enemy.y - player.y }; const separation = length(offset);
      const forward = offset.x * aim.x + offset.y * aim.y; const lateral = Math.abs(offset.x * aim.y - offset.y * aim.x);
      let hit = separation <= range + enemy.radius && (circle || forward >= separation * threshold);
      if (item.effect === 'dual' && !finisher) hit = enemy === target;
      if (item.effect === 'spear') hit = forward >= 0 && forward <= range + enemy.radius && lateral <= (mastery ? 1.1 : evolved ? .9 : item.width ?? .7) * branch.areaMultiplier / 2 + enemy.radius;
      if (!hit) continue;
      primary.ids.push(enemy.id); hitCount += 1;
      let multiplier = finisher ? mastery ? 1.5 : 1.25 : 1;
      if (mastery && item.effect === 'spear' && forward >= range - 1) { multiplier *= 1.25; tipHit = true; }
      if (staffBoost) multiplier *= 1.3;
      if (overloaded && (branch.supportLevels.overload ?? 0) >= 10 && !notified) multiplier *= 1.25;
      if (!notified) {
        const hit = { kind: 'weapon', sourceId: item.id, resonance: empowered > 0 ? 0 : branch.resonance };
        recordAbilityHit(player, hit); notified = true;
        if (overloaded) { progress.overload = 0; progress.overloadCast = 0; }
      }
      const mark = enemy.thunderMarks?.[player.id];
      if (item.effect === 'thunder-staff' && mark && mark.remaining > 0) {
        delete enemy.thunderMarks?.[player.id]; marks += 1;
        if (mark.residual) { enemy.thunderResiduals ??= {}; enemy.thunderResiduals[player.id] = 4; }
        const burst = { enemy, player, radius: (mastery ? 1.8 : evolved ? 1.5 : 1.2) * branch.areaMultiplier, damage: mark.power * (mark.charged ? 1.3 : 1) * (level >= 20 && staffBoost ? 1.2 : 1), id: `thunder-${id}-${enemy.id}` };
        thunderBurst(sim, burst);
        const arc = { id: `staff-link-${id}-${enemy.id}`, owner: player.id, x: player.x, y: player.y, facingX: enemy.x, facingY: enemy.y, radius: .5, kind: 'ability-transfer-thunder', duration: .25 }; addEffect(sim, arc);
      }
      const impact = { enemy, player, damage: damage * multiplier, flavor: item.effect, castId: id }; hurtEnemy(sim, impact);
      if (!sim.presentationOnly && branch.knockback > 0 && enemy.definition.rank !== 'boss' && sim.clock >= (enemy.knockbackAt ?? 0)) {
        const force = branch.knockback * (circle ? 1.5 : 1);
        const push = circle ? unit(offset) : aim;
        const movement = { x: push.x * force, y: push.y * force, radius: enemy.radius };
        const before = { x: enemy.x, y: enemy.y }; move(sim, enemy, movement);
        const moved = distance(before, enemy); const knockbackLevel = branch.supportLevels.knockback ?? 0;
        if (knockbackLevel >= 5 && moved < force * .5) {
          const collision: Effect = { id: `collision-${id}-${enemy.id}`, owner: player.id, sourceId: item.id, x: enemy.x, y: enemy.y, targetId: knockbackLevel >= 10 ? undefined : enemy.id, radius: knockbackLevel >= 20 ? 1.2 : .75, kind: 'ability-collision', damage: damage * (knockbackLevel >= 20 ? .45 : .3), duration: .3, ttl: .3 }; addGrowthField(sim, collision);
          if (knockbackLevel >= 15) { enemy.slowFactor = .25; enemy.slowUntil = sim.clock + 1; }
        }
        enemy.knockbackAt = sim.clock + .6;
        const recoil = { id: `recoil-${id}-${enemy.id}`, owner: player.id, x: enemy.x, y: enemy.y, facingX: push.x, facingY: push.y, radius: enemy.radius + .25, kind: 'ability-knockback', duration: .25 }; addEffect(sim, recoil);
      }
    }
    if (hitCount > 0) progress.landed += 1;
    if (item.effect === 'dual' && finisher && level >= 15) progress.retain = 6;
    if (item.effect === 'dual' && finisher && level >= 20) {
      const finish: Effect = { id: `${id}-finish`, owner: player.id, sourceId: item.id, x: target.x, y: target.y, targetId: target.id, radius: 1, kind: 'ability-dual-finish', damage: damage * .5, delay: .15, duration: .4, ttl: .4 }; addGrowthField(sim, finish);
    }
    if (item.effect === 'spear' && level >= 15 && hitCount >= 3) {
      const tip: Effect = { id: `${id}-tip`, owner: player.id, sourceId: item.id, x: player.x + aim.x * range, y: player.y + aim.y * range, radius: .7, kind: 'ability-spear-tip', damage: damage * .35, duration: .3, ttl: .3 }; addGrowthField(sim, tip);
    }
    if (item.effect === 'spear' && level >= 20 && tipHit) state.remaining *= .8;
    if (item.effect === 'thunder-staff' && level >= 15 && marks >= 2) progress.staff = 1;
    if (item.effect === 'hammer' && circle && level >= 15) {
      const cracks = sim.effects.filter(field => field.kind === 'ability-cracked-ground' && field.owner === player.id && field.sourceId === item.id && field.ttl > 0);
      if (level >= 20) for (const crack of cracks) {
        crack.ttl = 0; const burst: Effect = { ...crack, id: `${id}-crack-${crack.id}`, kind: 'ability-crack-burst', damage: damage * .4, slow: undefined, duration: .35, ttl: .35 }; addGrowthField(sim, burst);
      }
      if (cracks.length >= 3) cracks[0].ttl = 0;
      const ground: Effect = { id: `${id}-crack`, owner: player.id, sourceId: item.id, x: player.x, y: player.y, radius: range, kind: 'ability-cracked-ground', slow: .2, damage: 0, duration: 3, ttl: 3 }; addGrowthField(sim, ground);
    }
    const areaLevel = branch.supportLevels.area ?? 0;
    if (areaLevel >= 5 && (item.effect !== 'dual' || finisher)) {
      const edge: Effect = { id: `${id}-edge`, owner: player.id, sourceId: item.id, groupId: id, x: player.x, y: player.y, facingX: aim.x, facingY: aim.y, angle: circle ? 360 : angle, shape: item.effect, width: (mastery ? 1.1 : evolved ? .9 : item.width ?? .7) * branch.areaMultiplier * 1.25, innerWidth: (mastery ? 1.1 : evolved ? .9 : item.width ?? .7) * branch.areaMultiplier, radius: range * (areaLevel >= 10 ? 1.3 : 1.2), innerRadius: range, edge: true, kind: 'ability-area-edge', damage: damage * (areaLevel >= 15 ? .65 : .4), duration: areaLevel >= 20 ? .3 : .08, ttl: areaLevel >= 20 ? .3 : .08 }; addGrowthField(sim, edge);
    }
    const effect = { charged: overloaded, level, sourceId: item.id, swing: state.count % 2, angle, width: (mastery ? 1.1 : evolved ? .9 : item.width ?? .7) * branch.areaMultiplier, owner: player.id, empowered: empowered > 0, id: `melee-${id}`, x: player.x, y: player.y, radius: range, facingX: aim.x, facingY: aim.y, duration: .28, kind: circle ? item.effect === 'slash' ? 'ability-slash-circle' : 'ability-hammer-circle' : finisher ? 'ability-dual-cross' : `ability-${item.effect ?? 'slash'}` }; addEffect(sim, effect);
    if (branch.echo && item.effect === 'hammer') {
      const echo = { id, owner: player.id, sourceId: item.id, x: player.x + aim.x * range * .5, y: player.y + aim.y * range * .5, radius: range * .65, damage, level: branch.echo }; aftershock(sim, echo);
    }
    return;
  }
  const projectileSpeed = item.speed ?? 14; const starTargets: string[] = [];
  for (let index = 0; index < branch.projectiles; index += 1) {
    const multiple = branch.supportLevels.multiple ?? 0; const side = index === 0 || index === branch.projectiles - 1;
    const angle = (index - (branch.projectiles - 1) / 2) * (multiple >= 20 ? .32 : .22);
    const cosine = Math.cos(angle); const sine = Math.sin(angle);
    const vx = (aim.x * cosine - aim.y * sine) * projectileSpeed; const vy = (aim.y * cosine + aim.x * sine) * projectileSpeed;
    let targetId = target.id;
    if (item.effect === 'star') {
      const direction = { x: vx / projectileSpeed, y: vy / projectileSpeed };
      const search = { origin: player, direction, range, excluded: [], reserved: starTargets, forwardOnly: true };
      const selected = starTarget(sim, search); targetId = selected?.id ?? target.id; starTargets.push(targetId);
    }
    const blast = item.effect === 'fireball' ? (mastery ? 2 : 1.5) * branch.areaMultiplier : 0;
    const projectile: Projectile = { overload: overloaded ? branch.supportLevels.overload : 0, areaLevel: branch.supportLevels.area ?? 0, areaScale: branch.areaMultiplier, level, fork: branch.fork, spread: branch.spread, echo: branch.echo, returnable: item.effect === 'blade' && mastery, originX: player.x, originY: player.y, bounces: item.effect === 'star' ? mastery ? 2 : evolved ? 1 : 0 : 0, sourceId: item.id, resonance: empowered > 0 ? 0 : branch.resonance, empowered: empowered > 0, markDuration: mastery ? 8 : 6, id: `shot-${id}-${index}`, castId: id, effect: item.effect, targetId, travel: 0, x: player.x, y: player.y, owner: player.id, vx, vy, ttl: range / projectileSpeed * (multiple >= 10 && side ? 1.2 : 1), damage: damage * (multiple >= 15 && side ? 1.1 : 1), pierces: item.effect === 'blade' ? mastery ? 4 : evolved ? 3 : 2 : item.effect === 'thunder-seal' && mastery ? 2 : 1, hitIds: [], blast, slow: item.effect === 'frost' ? mastery ? .35 : .25 : 0, slowDuration: mastery ? 3 : 2, bounce: item.effect === 'star' && evolved };
    sim.projectiles.push(projectile);
    const cadence = branch.unleash >= 3 ? 3 : 4;
    if (branch.unleash && (state.count - progress.origin) % cadence === 0) {
      const repeats = branch.unleash >= 5 ? 2 : 1;
      for (let repeat = 1; repeat <= repeats; repeat += 1) {
        const delayed: Projectile = { ...projectile, id: `${projectile.id}-unleash-${repeat}`, castId: `${id}-unleash-${repeat}`, releaseLevel: branch.unleash, releaseGroup: `${id}-release`, delay: repeat * (branch.unleash >= 15 ? .12 : .18), damage: damage * .45, secondary: true, resonance: 0, overload: 0, areaLevel: 0, fork: 0, spread: 0, echo: 0, returnable: false, hitIds: [] };
        sim.projectiles.push(delayed);
      }
    }
  }
}
function thunderBurst(sim: Simulation, burst: { enemy: Enemy; player: Player; radius: number; damage: number; id: string }): void {
  for (const enemy of sim.enemies) {
    if (enemy.hp <= 0 || enemy.state === 'detonating' || enemy.state === 'escaped') continue;
    const separation = distance(enemy, burst.enemy);
    if (separation > burst.radius + enemy.radius) continue;
    const hit = { enemy, player: burst.player, damage: burst.damage, source: burst.enemy, bypassShield: true };
    hurtEnemy(sim, hit);
  }
  const effect = { id: burst.id, owner: burst.player.id, x: burst.enemy.x, y: burst.enemy.y, radius: burst.radius, kind: 'ability-thunder-burst', duration: .35 };
  addEffect(sim, effect);
}
function hitProjectile(sim: Simulation, shot: Projectile, data: { enemy: Enemy; player: Player; source: Vec }): void {
  const castId = shot.castId ?? shot.id;
  const group = sim.castHits[castId] ?? { ids: [], until: sim.clock + 8 };
  sim.castHits[castId] = group;
  const targets = shot.blast ? sim.enemies.filter(enemy => { const separation = distance(enemy, shot); return separation <= (shot.blast ?? 0) + enemy.radius; }) : [data.enemy];
  let impacted = false; let killed = false; const wasSlowed = (data.enemy.frostMarks?.[data.player.id] ?? 0) > sim.clock && data.enemy.frostCasts?.[data.player.id] !== castId;
  for (const enemy of targets) {
    if (group.ids.includes(enemy.id) || enemy.hp <= 0 || enemy.state === 'detonating') continue;
    if (group.ids.length === 0) {
      if (shot.overload) { const state = data.player.abilityStates.find(entry => entry.itemId === shot.sourceId); if (state?.progress && shot.castId === `${data.player.id}-${shot.sourceId}-${state.progress.overloadCast}`) { state.progress.overload = 0; state.progress.overloadCast = 0; } }
      const hit = { kind: 'skill', sourceId: shot.sourceId ?? '', resonance: shot.resonance ?? 0 };
      if (!shot.secondary && !shot.returning) recordAbilityHit(data.player, hit);
    }
    group.ids.push(enemy.id); impacted = true;
    if (!shot.blast) {
      const effect = { id: `impact-${shot.id}-${enemy.id}`, owner: data.player.id, x: enemy.x, y: enemy.y, radius: .55, kind: `ability-impact-${shot.effect ?? 'blade'}`, duration: .32 };
      addEffect(sim, effect);
    }
    if (shot.effect === 'thunder-seal') {
      enemy.thunderMarks ??= {};
      enemy.thunderMarks[data.player.id] = { residual: (shot.level ?? 1) >= 15, remaining: shot.markDuration ?? 6, power: shot.damage * 2, charged: (shot.level ?? 1) >= 20 && (enemy.thunderResiduals?.[data.player.id] ?? 0) > 0, transfer: (shot.level ?? 1) >= 5 };
    }
    const overloadGroup = `${castId}-overload`; const firstOverload = (shot.overload ?? 0) >= 10 && !sim.castHits[overloadGroup];
    if (firstOverload) sim.castHits[overloadGroup] = { ids: [enemy.id], until: sim.clock + 8 };
    const hit = { player: data.player, enemy, damage: shot.damage * (firstOverload ? 1.25 : 1), source: data.source, bypassShield: Boolean(shot.blast), flavor: shot.effect, castId: shot.castId }; hurtEnemy(sim, hit);
    if (enemy.id === data.enemy.id && enemy.hp <= 0) killed = true;
    if (shot.slow && !sim.presentationOnly) {
      const factor = enemy.definition.rank === 'boss' ? shot.slow / 2 : shot.slow;
      const active = (enemy.slowUntil ?? 0) > sim.clock;
      enemy.slowFactor = active ? Math.max(enemy.slowFactor ?? 0, factor) : factor;
      enemy.slowUntil = sim.clock + (shot.slowDuration ?? 2);
    }
  }
  if (impacted) { const evolution = { shot, enemy: data.enemy, player: data.player, wasSlowed, killed }; const actions = { hurt: hurtEnemy }; evolveImpact(sim, evolution, actions); }
  if (shot.blast) { const effect = { owner: data.player.id, id: `burst-${shot.id}`, x: shot.x, y: shot.y, radius: shot.blast, kind: 'ability-explosion', duration: .4 }; addEffect(sim, effect); }
  if ((shot.bounces ?? 0) > 0 && impacted) {
    shot.bounce = false;
    let next: Enemy | undefined; let limit = 3;
    for (const enemy of sim.enemies) {
      if (enemy.hp <= 0 || enemy.state === 'detonating' || enemy.state === 'escaped' || group.ids.includes(enemy.id)) continue;
      const separation = distance(enemy, data.enemy); if (separation < limit) { next = enemy; limit = separation; }
    }
    if (!next && (shot.level ?? 1) >= 20 && !shot.terminal && data.enemy.hp > 0) {
      const terminal: Effect = { id: `${shot.id}-terminal`, owner: data.player.id, sourceId: shot.sourceId, x: data.enemy.x, y: data.enemy.y, targetId: data.enemy.id, radius: 1, kind: 'ability-star-terminal', damage: shot.damage * .35 * (shot.bounces ?? 1), delay: .12, duration: .35, ttl: .35 }; addGrowthField(sim, terminal);
    }
    if (next) {
      const delta = { x: next.x - data.enemy.x, y: next.y - data.enemy.y }; const aim = unit(delta);
      const rebound = { ...shot, id: `${shot.id}-bounce`, x: data.enemy.x, y: data.enemy.y, vx: aim.x * 14, vy: aim.y * 14, ttl: 3 / 14 + .15, damage: shot.damage * .5, targetId: next.id, pierces: 1, hitIds: [...group.ids], travel: 1.4, bounces: (shot.bounces ?? 1) - 1, fork: 0 };
      sim.projectiles.push(rebound);
    }
  }
}
// 怪物技能在共享模拟中推进；画像始终静态，状态只驱动位置和独立特效。
export function enemyBehavior(enemy: Enemy): string {
  return enemy.definition.behavior ?? (enemy.kind === 'swift' ? 'wolf' : enemy.kind === 'elite' ? 'hammer' : 'tree');
}
export function enemyAttackArea(enemy: Enemy): { x: number; y: number; radius: number; length: number; width: number } {
  const behavior = enemyBehavior(enemy);
  const radius = behavior === 'bomb' ? enemy.definition.reach : behavior === 'hammer' ? 1.25 : enemy.radius + enemy.definition.reach;
  const length = behavior === 'wolf' ? 4.5 : behavior === 'shield' ? 1.8 : enemy.definition.reach;
  return { x: enemy.attackX ?? enemy.x, y: enemy.attackY ?? enemy.y, radius, length, width: enemy.radius * 2 + .25 };
}
function contactDamage(sim: Simulation): void {
  if (sim.presentationOnly) return;
  for (const player of sim.players) {
    if (player.hp <= 0 || (player.contactNextAt ?? 0) > sim.clock) continue;
    let touching: Enemy | undefined;
    for (const enemy of sim.enemies) {
      if (enemy.hp <= 0 || enemy.state === 'detonating' || enemy.state === 'escaped') continue;
      const separation = distance(player, enemy);
      if (separation > enemy.radius + .4) continue;
      if (!touching || enemy.definition.damage > touching.definition.damage) touching = enemy;
    }
    if (!touching) continue;
    player.contactNextAt = sim.clock + .8;
    const hit = { source: touching, damage: touching.definition.damage * .5 };
    hurtPlayer(sim, player, hit);
  }
}

function hurtPlayer(sim: Simulation, player: Player, hit: { source: Vec; damage: number; blockable?: boolean }): void {
  if (sim.presentationOnly || player.hp <= 0) return;
  const delta = { x: hit.source.x - player.x, y: hit.source.y - player.y }; const direction = unit(delta);
  const guarded = hit.blockable !== false && player.blocking && direction.x * player.facingX + direction.y * player.facingY >= .5;
  const damage = hit.damage * 100 / (100 + player.stats.physicalDefense) * (guarded ? .3 : 1);
  const absorbed = Math.min(player.lootShield, damage); player.lootShield -= absorbed;
  const actual = Math.min(player.hp, damage - absorbed);
  player.hp = Math.max(0, player.hp - actual);
  if (player.hp === 0) { player.reviveRemaining = sim.config.revivalSeconds ?? 15; player.blocking = false; player.dashLeft = 0; player.weaponState = '灵魂状态'; player.skillState = '灵魂状态'; }
  if (guarded) player.blocked += 1;
  const effect: Effect = { id: `impact-${sim.nextId + 1}`, ttl: .5, duration: .5, targetId: player.id, targetKind: 'player', damage: actual, absorbed, killed: player.hp <= 0, facingX: -direction.x, facingY: -direction.y, x: player.x, y: player.y, radius: .5, kind: guarded ? 'block' : actual <= 0 ? 'absorb' : 'hurt' }; addEffect(sim, effect);
}
function segmentDistance(point: Vec, segment: { from: Vec; to: Vec }): number {
  const dx = segment.to.x - segment.from.x; const dy = segment.to.y - segment.from.y; const squared = dx * dx + dy * dy;
  const projection = squared === 0 ? 0 : ((point.x - segment.from.x) * dx + (point.y - segment.from.y) * dy) / squared;
  const t = clamp(projection, 0, 1); const nearest = { x: segment.from.x + dx * t, y: segment.from.y + dy * t };
  return distance(point, nearest);
}
function enemyEffect(sim: Simulation, enemy: Enemy, kind: string): void {
  const area = enemyAttackArea(enemy);
  const behavior = enemyBehavior(enemy);
  const effect = { id: `${enemy.id}-attack-${enemy.attackCount ?? 0}-${kind}`, x: behavior === 'hammer' ? area.x : enemy.x, y: behavior === 'hammer' ? area.y : enemy.y, radius: area.radius, kind, duration: .55, facingX: enemy.facingX, facingY: enemy.facingY };
  addEffect(sim, effect);
}
function beginEnemyAttack(enemy: Enemy, target: Vec): void {
  const behavior = enemyBehavior(enemy);
  const delta = { x: target.x - enemy.x, y: target.y - enemy.y }; const aim = unit(delta);
  enemy.facingX = aim.x; enemy.facingY = aim.y;
  enemy.state = behavior === 'bomb' ? 'detonating' : 'windup'; enemy.timer = enemy.definition.windup;
  enemy.originX = enemy.x; enemy.originY = enemy.y; enemy.attackCount = (enemy.attackCount ?? 0) + 1; enemy.hitIds = [];
  const separation = length(delta); const offset = Math.min(separation, enemy.definition.reach);
  enemy.attackX = enemy.x + aim.x * offset; enemy.attackY = enemy.y + aim.y * offset;
}
function explodeEnemy(sim: Simulation, enemy: Enemy): void {
  enemyEffect(sim, enemy, 'enemy-blast');
  if (!sim.presentationOnly) {
    const area = enemyAttackArea(enemy);
    const owner = sim.players.find(player => player.id === enemy.killerId);
    for (const player of sim.players) {
      const separation = distance(player, enemy);
      if (separation <= area.radius + .4) { const hit = { source: enemy, damage: enemy.definition.damage }; hurtPlayer(sim, player, hit); }
    }
    for (const victim of sim.enemies) {
      if (victim === enemy || victim.hp <= 0) continue;
      const separation = distance(victim, enemy);
      if (separation <= area.radius + victim.radius) { const hit = { enemy: victim, player: owner, damage: enemy.definition.damage * 3, source: enemy, bypassShield: true }; hurtEnemy(sim, hit); }
    }
    if (owner) { owner.kills += 1; awardCombatGrowth(sim, owner, true); if (!enemy.parentId) sim.defeated.push(enemy); }
    for (const player of sim.players) {
      const contribution = enemy.contributors?.[player.id];
      if (player !== owner && contribution !== undefined && sim.clock - contribution <= 15) { player.assists += 1; awardCombatGrowth(sim, player, false); }
    }
    enemy.hp = 0; transferDeathMarks(sim, enemy);
  }
  enemy.state = 'spent';
}
function executeEnemyAttack(sim: Simulation, enemy: Enemy): void {
  const behavior = enemyBehavior(enemy); const area = enemyAttackArea(enemy);
  if (behavior === 'wolf' || behavior === 'shield') { enemy.state = 'charge'; enemy.timer = area.length / (behavior === 'wolf' ? 10 : 6); return; }
  if (behavior === 'archer') {
    const count = enemy.definition.rank === 'boss' ? 5 : enemy.definition.rank === 'elite' ? 3 : 1;
    const angle = Math.atan2(enemy.facingY, enemy.facingX);
    for (let index = 0; index < count; index += 1) {
      const direction = angle + (index - (count - 1) / 2) * .22; const dx = Math.cos(direction); const dy = Math.sin(direction);
      const shot = { id: `${enemy.id}-arrow-${enemy.attackCount}-${index}`, owner: enemy.id, hostile: true, x: enemy.x + dx * enemy.radius, y: enemy.y + dy * enemy.radius, vx: dx * 8, vy: dy * 8, ttl: enemy.definition.reach / 8, damage: enemy.definition.damage };
      sim.projectiles.push(shot);
    }
    enemyEffect(sim, enemy, 'enemy-shot');
  } else {
    const center = behavior === 'hammer' ? { x: area.x, y: area.y } : enemy;
    for (const player of sim.players) {
      const separation = distance(player, center); const delta = { x: player.x - enemy.x, y: player.y - enemy.y }; const aim = unit(delta);
      const inSector = behavior === 'hammer' || aim.x * enemy.facingX + aim.y * enemy.facingY >= .5;
      if (separation <= area.radius + .4 && inSector) { const hit = { source: enemy, damage: enemy.definition.damage }; hurtPlayer(sim, player, hit); }
    }
    const kind = behavior === 'hammer' ? 'enemy-smash' : 'enemy-sweep'; enemyEffect(sim, enemy, kind);
  }
  enemy.state = 'recovery'; enemy.timer = enemy.definition.recovery;
}
function chargeEnemy(sim: Simulation, enemy: Enemy, dt: number): void {
  const behavior = enemyBehavior(enemy); const speed = behavior === 'wolf' ? 10 : 6; const duration = Math.min(dt, enemy.timer);
  const from = { x: enemy.x, y: enemy.y };
  const destination = { x: enemy.x + enemy.facingX * speed * duration, y: enemy.y + enemy.facingY * speed * duration };
  const allowed = legal(sim.arena, destination, enemy.radius);
  if (allowed) { enemy.x = destination.x; enemy.y = destination.y; }
  const segment = { from, to: enemy }; const area = enemyAttackArea(enemy);
  enemy.hitIds ??= [];
  for (const player of sim.players) {
    if (enemy.hitIds.includes(player.id)) continue;
    const separation = segmentDistance(player, segment);
    if (separation <= area.width / 2 + .4) {
      enemy.hitIds.push(player.id);
      const source = { x: player.x - enemy.facingX, y: player.y - enemy.facingY };
      const hit = { source, damage: enemy.definition.damage }; hurtPlayer(sim, player, hit);
    }
  }
  enemy.timer -= dt;
  if (enemy.timer <= 0 || (from.x === enemy.x && from.y === enemy.y)) {
    const kind = behavior === 'wolf' ? 'enemy-claw' : 'enemy-shield'; enemyEffect(sim, enemy, kind);
    enemy.state = 'recovery'; enemy.timer = enemy.definition.recovery;
  }
}
function enemyStep(sim: Simulation, enemy: Enemy, dt: number): void {
  if (enemy.hp <= 0 || enemy.state === 'spent' || enemy.state === 'escaped') return;
  const tactic = { dt, actions: enemyActions }; const handled = stepEnemyTactic(sim, enemy, tactic); if (handled) return;
  const definition = enemy.definition; const behavior = enemyBehavior(enemy);
  if (enemy.state === 'detonating') { enemy.timer -= dt; if (enemy.timer <= 0) explodeEnemy(sim, enemy); return; }
  if (enemy.state === 'windup') { enemy.timer -= dt; if (enemy.timer <= 0) executeEnemyAttack(sim, enemy); return; }
  if (enemy.state === 'charge') { chargeEnemy(sim, enemy, dt); return; }
  if (enemy.state === 'retreat') {
    const duration = Math.min(dt, enemy.timer);
    const movement = { x: -enemy.facingX * definition.speed * duration, y: -enemy.facingY * definition.speed * duration, radius: enemy.radius };
    move(sim, enemy, movement); enemy.timer -= dt;
    if (enemy.timer <= 0) enemy.state = 'chase';
    return;
  }
  let target = sim.players.find(player => player.id === enemy.targetId && player.hp > 0);
  if (!target) {
    let limit = Infinity;
    for (const player of sim.players) { if (player.hp <= 0) continue; const separation = distance(enemy, player); if (separation < limit || (separation === limit && player.id < (target?.id ?? '~'))) { target = player; limit = separation; } }
    enemy.targetId = target?.id ?? '';
  }
  if (enemy.state === 'recovery') {
    enemy.timer -= dt;
    if (enemy.timer > 0) return;
    if (behavior === 'archer' && target) {
      const separation = distance(enemy, target);
      if (separation < 3) { enemy.state = 'retreat'; enemy.timer = .6; return; }
    }
    const comboLimit = definition.rank === 'boss' ? 2 : definition.rank === 'elite' ? 1 : 0;
    if (target && (behavior === 'wolf' || behavior === 'tree' || behavior === 'hammer') && (enemy.combo ?? 0) < comboLimit) {
      enemy.combo = (enemy.combo ?? 0) + 1; beginEnemyAttack(enemy, target); return;
    }
    enemy.combo = 0; enemy.state = 'chase';
  }
  if (!target) { enemy.state = 'seek'; return; }
  const delta = { x: target.x - enemy.x, y: target.y - enemy.y }; const aim = unit(delta); const separation = length(delta);
  if (behavior === 'shield') {
    const current = Math.atan2(enemy.facingY, enemy.facingX); const desired = Math.atan2(aim.y, aim.x);
    const difference = desired - current; const sine = Math.sin(difference); const cosine = Math.cos(difference); const wrapped = Math.atan2(sine, cosine);
    const turn = clamp(wrapped, -dt * 1.4, dt * 1.4); const angle = current + turn;
    enemy.facingX = Math.cos(angle); enemy.facingY = Math.sin(angle);
  } else { enemy.facingX = aim.x; enemy.facingY = aim.y; }
  const trigger = behavior === 'wolf' ? 4.3 : behavior === 'shield' ? 2.2 : behavior === 'bomb' ? 1.8 : definition.reach + enemy.radius + .4;
  const aligned = behavior !== 'shield' || enemy.facingX * aim.x + enemy.facingY * aim.y > .93;
  if (separation <= trigger && aligned) {
    const crowded = sim.enemies.some(other => {
      if (other === enemy || (other.state !== 'windup' && other.state !== 'charge')) return false;
      const nearby = distance(other, enemy); return nearby < 2.5;
    });
    if (!crowded || behavior === 'bomb') { beginEnemyAttack(enemy, target); return; }
  }
  enemy.state = 'chase';
  const slow = (enemy.slowUntil ?? 0) > sim.clock ? 1 - (enemy.slowFactor ?? 0) : 1;
  const movement = { x: enemy.facingX * definition.speed * dt * slow, y: enemy.facingY * definition.speed * dt * slow, radius: enemy.radius };
  if (behavior === 'archer' && separation <= definition.reach) return;
  const previous = { x: enemy.x, y: enemy.y }; move(sim, enemy, movement);
  if (previous.x === enemy.x && previous.y === enemy.y) {
    const side = { x: -aim.y * definition.speed * dt * slow, y: aim.x * definition.speed * dt * slow, radius: enemy.radius }; move(sim, enemy, side);
  }
}
const enemyActions: EnemyActions = { move, legal, hurt: hurtPlayer, effect: addEffect };

export function step(sim: Simulation, dt: number): void {
  if (sim.finished) return;
  if (sim.preparing) {
    if (!sim.presentationOnly && sim.players.every(player => player.hp <= 0)) { sim.finished = true; sim.success = false; return; }
    for (const player of sim.players) {
      if (player.hp <= 0) player.reviveRemaining = Math.max(0, player.reviveRemaining - dt);
      const fresh = player.connected && sim.clock - player.inputAt <= .6;
      if (fresh && !player.clientDriven) {
        const direction = unit(player.input);
        const movement = { x: direction.x * player.stats.movementSpeed * dt, y: direction.y * player.stats.movementSpeed * dt, radius: .4 };
        move(sim, player, movement);
        if (direction.x || direction.y) { player.facingX = direction.x; player.facingY = direction.y; }
      }
      player.input.dash = false; player.blocking = false;
    }
    return;
  }
  if (!sim.presentationOnly) {
    const wiped = sim.players.every(player => player.hp <= 0);
    if (wiped) { sim.finished = true; sim.success = false; return; }
    for (const player of sim.players) player.survivalSeconds += dt;
  }
  sim.elapsed += dt; sim.clock += dt;
  const spawnActions = { legal }; spawnWaveBatch(sim, spawnActions);
  for (const player of sim.players) playerStep(sim, player, dt);
  for (const enemy of sim.enemies) enemyStep(sim, enemy, dt);
  contactDamage(sim);
  if (!sim.presentationOnly) {
    const wiped = sim.players.every(player => player.hp <= 0);
    if (wiped) { sim.finished = true; sim.success = false; return; }
  }
  for (const shot of [...sim.projectiles]) {
    if (shot.ttl <= 0) continue;
    if ((shot.delay ?? 0) > 0) {
      const owner = sim.players.find(player => player.id === shot.owner);
      if (!owner || owner.hp <= 0 || !owner.equipment.branches.some(branch => branch.item.id === shot.sourceId)) { shot.ttl = 0; continue; }
      shot.delay = Math.max(0, (shot.delay ?? 0) - dt); if (shot.delay > 0) continue;
      shot.x = owner.x; shot.y = owner.y;
      if ((shot.releaseLevel ?? 0) >= 10) {
        const key = shot.releaseGroup ?? shot.id; const selected = sim.castHits[key]?.ids[0];
        const locked = (shot.releaseLevel ?? 0) >= 20 ? sim.enemies.find(enemy => enemy.id === selected && enemy.hp > 0) : undefined;
        const target = locked ?? nearest(sim, owner, 9);
        if (target) {
          sim.castHits[key] = { ids: [target.id], until: sim.clock + 8 }; shot.targetId = target.id;
          const direction = { x: target.x - owner.x, y: target.y - owner.y }; const aim = unit(direction); const speed = Math.hypot(shot.vx, shot.vy); shot.vx = aim.x * speed; shot.vy = aim.y * speed;
        }
      }
    }
    if (shot.effect === 'star') guideStar(sim, shot, dt);
    let flight = Math.min(dt, shot.ttl);
    if (shot.returning) {
      const owner = sim.players.find(player => player.id === shot.owner);
      const follow = (shot.level ?? 1) >= 20 && owner;
      const destination = follow ? owner : { x: shot.originX ?? shot.x, y: shot.originY ?? shot.y };
      const direction = { x: destination.x - shot.x, y: destination.y - shot.y }; const separation = length(direction);
      if (separation < .08) { shot.ttl = 0; continue; }
      const aim = unit(direction); const speed = Math.hypot(shot.vx, shot.vy);
      shot.vx = aim.x * speed; shot.vy = aim.y * speed;
      flight = Math.min(flight, separation / speed);
    }
    const from = { x: shot.x, y: shot.y };
    const speed = Math.hypot(shot.vx, shot.vy); const count = shot.effect === 'blade' ? Math.ceil(speed * flight / .08) : 1; const slices = Math.max(1, count);
    let blocked = false;
    for (let slice = 0; slice < slices; slice += 1) {
      const next = { x: shot.x + shot.vx * flight / slices, y: shot.y + shot.vy * flight / slices };
      const valid = legal(sim.arena, next, .08);
      if (!valid) { blocked = true; break; } shot.x = next.x; shot.y = next.y;
    }
    shot.ttl = blocked ? 0 : shot.ttl - dt;
    if (blocked && shot.returnable) {
      const impact = { id: `${shot.id}-wall`, owner: shot.owner, x: shot.x, y: shot.y, radius: .65, kind: 'ability-impact-blade', duration: .3 }; addEffect(sim, impact);
    }
    if (shot.hostile) {
      const segment = { from, to: shot };
      for (const target of sim.players) {
        if (target.hp <= 0) continue;
        const separation = segmentDistance(target, segment);
        if (separation <= .48) { const hit = { source: from, damage: shot.damage }; hurtPlayer(sim, target, hit); shot.ttl = 0; break; }
      }
      continue;
    }
    const player = sim.players.find(item => item.id === shot.owner); if (!player) continue;
    const castHits = sim.castHits[shot.castId ?? shot.id]?.ids ?? [];
    for (const enemy of sim.enemies) {
      if (enemy.hp <= 0 || enemy.state === 'detonating' || enemy.state === 'escaped' || shot.hitIds?.includes(enemy.id) || castHits.includes(enemy.id)) continue;
      const dx = shot.x - from.x; const dy = shot.y - from.y; const squared = dx * dx + dy * dy;
      const projection = squared === 0 ? 0 : ((enemy.x - from.x) * dx + (enemy.y - from.y) * dy) / squared;
      const t = clamp(projection, 0, 1); const closest = { x: from.x + t * dx, y: from.y + t * dy }; const separation = distance(enemy, closest);
      if (separation <= enemy.radius + 0.08) {
        shot.hitIds ??= []; shot.hitIds.push(enemy.id);
        const impact = { enemy, player, source: from }; hitProjectile(sim, shot, impact);
        shot.pierces = (shot.pierces ?? 1) - 1;
        if (shot.pierces <= 0) { shot.ttl = 0; break; }
      }
    }
  }
  for (const shot of sim.projectiles) returnProjectile(shot);
  const evolutionActions = { hurt: hurtEnemy }; stepEvolution(sim, dt, evolutionActions); stepNovel(sim, dt, evolutionActions);
  for (const enemy of sim.enemies) {
    for (const owner of Object.keys(enemy.thunderResiduals ?? {})) { if (enemy.thunderResiduals) enemy.thunderResiduals[owner] = Math.max(0, enemy.thunderResiduals[owner] - dt); }
    for (const [owner, mark] of Object.entries(enemy.thunderMarks ?? {})) {
      mark.remaining -= dt;
      if (mark.remaining <= 0) delete enemy.thunderMarks?.[owner];
    }
  }
  stepEnemyHazards(sim, dt, enemyActions);
  for (const [id, hit] of Object.entries(sim.castHits)) if (hit.until < sim.clock) delete sim.castHits[id];
  const novelDeathActions = { hurt: hurtEnemy }; stepNovel(sim, 0, novelDeathActions);
  sim.projectiles = sim.projectiles.filter(shot => shot.ttl > 0); sim.enemies = sim.enemies.filter(enemy => enemy.hp > 0);
  for (const effect of sim.effects) effect.ttl -= dt;
  sim.effects = sim.effects.filter(effect => effect.ttl > 0);
  if (sim.presentationOnly) return;
  const wiped = sim.players.every(player => player.hp <= 0);
  if (wiped) { sim.finished = true; sim.success = false; }
}


