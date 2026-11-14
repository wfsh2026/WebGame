export * from './guard';
import { counterDamage, guardHit, resetGuard, stepGuard } from './guard';
import type { GuardState } from './guard';
export * from './expedition';
import { clearExpeditionCombat, expeditionWave } from './expedition';
import type { ExpeditionDifficulty, ExpeditionRules } from './expedition';
export * from './adventure-progression';
import { SpatialEnemies } from './spatial-enemies';
import { guideHoming, homingStats, initializeHoming } from './homing';
export { homingStats } from './homing';
const collisionGrids = new WeakMap<Simulation, SpatialEnemies>();
import { bannerCast, bannerDamage, bannerFlight, bannerGuard, bannerRecovery, spendBannerRecovery, stepBanners, bannerWind, bannerBuff } from './banners';
import type { BannerState, BannerField, MeleeCast } from './banners';
export * from './banners';
import { stepBannerCombat } from './banner-combat';
import { castNovel, stepNovel } from './novel-skills';
import type { NovelFields } from './novel-skills';
import { abilityProgress, attackInterval, castModifiers, prepareRhythm, commitCast, heartRecovery } from './combat-rhythm';
import type { AbilityProgress, HeartProgress } from './combat-rhythm';
export * from './combat-rhythm';
export * from './ability-growth';
import { addGrowthField, aftershock, evolveImpact, returnProjectile, stepEvolution, transferDeathMarks } from './skill-evolution';
import type { EvolutionShot, EvolutionEffect } from './skill-evolution';
import { planWave, spawnWaveBatch, waveProfile } from './waves';
import type { CompositionRules, WaveDirector } from './wave-composition';
export * from './wave-composition';
import type { SpawnGroup, WaveSchedule } from './waves';
import type { WaveMix, WaveEntry } from './waves';
export * from './waves';
import { updateResonance, consumeResonance, recordAbilityHit, resonanceState } from './resonance';
import type { ResonanceState, ThunderMark } from './resonance';
import { protectedBy, stepEnemyHazards, stepEnemyTactic } from './enemy-tactics';
import { enemyAbilities, enemyShielded } from './enemy-abilities';
import type { EnemyAbilityState } from './enemy-abilities';
import { enemyCombatArea, stepEnemyCombat } from './enemy-combat';
export * from './enemy-abilities';
import type { EnemyActions, EnemyHazard } from './enemy-tactics';
export type { EnemyHazard } from './enemy-tactics';
import { defaultEquipment, equipmentRuntime, heartCapacity, isBanner } from './equipment';
import type { EquipmentLoadout, EquipmentSupport, EquipmentItem } from './equipment';
export * from './equipment';
export * from './build-growth';
export * from './combat-experience';
import { dropCombatExperience, settleClaimedExperience, stepExperience } from './combat-experience';
import type { ExperienceOrb } from './combat-experience';
export * from './character-growth';
import { awardCombatGrowth } from './build-growth';
import type { BuildItem } from './equipment';
import type { GrowthChoice } from './build-growth';
import { calculateCharacterStats } from './characters';
import type { CharacterBuild, CharacterStats, CharacterPoints } from './characters';
export * from './characters';
export * from './survival';
export interface Vec { x: number; y: number }
export interface Obstacle extends Vec { width: number; height: number }
export interface EnemyDefinition { kind: string; name?: string; behavior?: string; rank?: string; hp: number; speed: number; radius: number; damage: number; windup: number; recovery: number; reach: number }
export interface WaveDefinition { composition?: CompositionRules; bossPools?: string[][]; groups?: SpawnGroup[]; interval: number; count: number; kinds: string[]; name?: string; hint?: string; mix?: WaveMix[]; stageMixes?: WaveMix[][]; eliteChance?: number; bossChance?: number; guarantee?: 'none' | 'elite' | 'boss'; healthMultiplier?: number; damageMultiplier?: number; squirrels?: boolean }
export interface SimConfig { difficulty?: ExpeditionDifficulty; expedition?: ExpeditionRules; cycleWaves?: boolean; equipmentDefinitions?: EquipmentItem[]; waves?: WaveDefinition[]; revivalSeconds?: number; supportDefinitions?: EquipmentSupport[]; roundDuration: number; character: { points: { power: number; magic: number; vitality: number; spirit: number; movement: number; haste: number; luck?: number } }; heart: { capacity: number; interval: number; recovery: number; slots?: number }; meleeSkill: { interval: number; cost: number; coefficient: number; speed: number; range: number; supportSlots?: number }; rangedSkill: { interval: number; cost: number; coefficient: number; range: number; supportSlots?: number }; support: { host?: string; costMultiplier: number; damageMultiplier: number }; enemies: EnemyDefinition[] }
export interface Motion extends Vec { facingX: number; facingY: number }
export interface Controls extends Vec { blockPress?: number; sequence: number; block: boolean; dash: boolean; position?: Motion }
export interface AbilityState { progress?: AbilityProgress; itemId: string; remaining: number; count: number; state: string }
export interface Player extends Vec { guard?: GuardState; characterLevel?: number; coinsEarned?: number; coinsSpent?: number; banners?: BannerState; heartProgress?: HeartProgress; growthNotices?: string[]; contactNextAt?: number; fusionNotices?: string[]; hasteLeft: number; focusLeft: number; shieldLeft: number; lootShield: number; baseStats: CharacterStats; characterRanks: Record<string, number>; energyRecoveryBonus: number; resonance?: ResonanceState; companionGranted?: boolean; companionMilestones?: number[]; buildItems: BuildItem[]; buildRevision: number; level: number; experience: number; upgradeCredits: number; waveCredits: number; choiceSequence: number; choices: GrowthChoice[]; abilityStates: AbilityState[]; loadout: EquipmentLoadout; equipment: ReturnType<typeof equipmentRuntime>; stats: CharacterStats; id: string; name: string; facingX: number; facingY: number; hp: number; maxHp: number; energy: number; capacity: number; meleeWait: number; rangedWait: number; meleeState: string; rangedState: string; dashCooldown: number; blocking: boolean; connected: boolean; ready: boolean; growth: ('power' | 'energy' | 'vitality')[]; kills: number; damage: number; blocked: number; input: Controls; inputAt: number; dashLeft: number; dashX: number; dashY: number; heartWait: number; sequence: number; meleeCount: number; rangedCount: number; clientDriven: boolean; survivalSeconds: number; reviveRemaining: number; assists: number }
export interface Enemy extends Vec { abilities?: EnemyAbilityState; expiresAt?: number; chainDepth?: number; thunderResiduals?: Record<string, number>; strongFrostAt?: Record<string, number>; frostMarks?: Record<string, number>; frostCasts?: Record<string, string>; burnUntil?: Record<string, number>; bornWave?: number; healthScale?: number; damageScale?: number; thunderMarks?: Record<string, ThunderMark>; slowUntil?: number; slowFactor?: number; knockbackAt?: number; id: string; kind: string; radius: number; hp: number; maxHp: number; state: string; facingX: number; facingY: number; timer: number; targetId: string; definition: EnemyDefinition; contributors?: Record<string, number>; attackX?: number; attackY?: number; originX?: number; originY?: number; attackCount?: number; combo?: number; hitIds?: string[]; killerId?: string; linkId?: string; linkWait?: number; parentId?: string; summonCount?: number; escapeLeft?: number }
export interface Projectile extends Vec, EvolutionShot { homing?: number; homingTravel?: number; windScale?: number; sourceId?: string; resonance?: number; empowered?: boolean; markDuration?: number; id: string; owner: string; vx: number; vy: number; ttl: number; damage: number; hostile?: boolean; effect?: string; castId?: string; targetId?: string; pierces?: number; hitIds?: string[]; blast?: number; slow?: number; slowDuration?: number; bounce?: boolean }
export interface Effect extends Vec, EvolutionEffect, NovelFields { amount?: number; banner?: BannerField; melee?: MeleeCast; charged?: boolean; targetId?: string; targetKind?: 'player' | 'enemy'; damage?: number; absorbed?: number; killed?: boolean; flavor?: string; castId?: string; level?: number; swing?: number; angle?: number; width?: number; owner?: string; empowered?: boolean; id: string; radius: number; kind: string; ttl: number; duration?: number; facingX?: number; facingY?: number }
export interface Arena { width: number; height: number; spawns: Vec[]; enemySpawns: Vec[]; obstacles: Obstacle[] }
export interface Simulation { experienceOrbs: ExperienceOrb[]; waveDirector?: WaveDirector; waveSchedules: WaveSchedule[]; spawnHistory: Vec[]; waveBossPlanned: boolean; spawnIssued: number; preparing?: boolean; defeated: Enemy[]; waveQueue: WaveEntry[]; hazards: EnemyHazard[]; poisonWait: Record<string, number>; config: SimConfig; arena: Arena; players: Player[]; enemies: Enemy[]; projectiles: Projectile[]; effects: Effect[]; elapsed: number; clock: number; spawnWait: number; spawned: number; nextId: number; round: number; random: () => number; finished: boolean; success: boolean; presentationOnly: boolean; partySize: number; castHits: Record<string, { ids: string[]; until: number }> }

export function makePlayer(identity: { id: string; name: string }, config: SimConfig): Player {
  const points = config.character.points;
  const build = { points: { ...points, luck: points.luck ?? 0 }, talents: [] };
  const stats = calculateCharacterStats(build);
  const maxHp = stats.maxHp;
  const loadout = defaultEquipment(config);
  const equipment = equipmentRuntime(loadout, config);
  const capacity = heartCapacity(equipment.heartItem, stats.energyCapacityBonus);
  return { ...identity, guard: { windowLeft: 0, counterLeft: 0, press: 0, held: false, triggered: false }, hasteLeft: 0, focusLeft: 0, shieldLeft: 0, lootShield: 0, baseStats: { ...stats }, characterRanks: {}, energyRecoveryBonus: 0, buildItems: [], buildRevision: 0, level: 1, experience: 0, upgradeCredits: 0, waveCredits: 0, choiceSequence: 0, choices: [], abilityStates: [], loadout, equipment, stats, x: 15, y: 11, facingX: 0, facingY: 1, hp: maxHp, maxHp, energy: capacity, capacity, meleeWait: 0, rangedWait: 0, meleeState: '就绪', rangedState: '就绪', dashCooldown: 0, blocking: false, connected: true, ready: false, growth: [], kills: 0, damage: 0, blocked: 0, input: { sequence: 0, x: 0, y: 0, block: false, dash: false }, inputAt: 0, dashLeft: 0, dashX: 0, dashY: 1, heartWait: config.heart.interval, sequence: -1, meleeCount: 0, rangedCount: 0, clientDriven: false, survivalSeconds: 0, reviveRemaining: 0, assists: 0 };
}

export function applyEquipment(player: Player, data: { loadout: EquipmentLoadout; config: SimConfig }): void {
  player.loadout = data.loadout;
  player.equipment = equipmentRuntime(data.loadout, data.config);
  player.abilityStates = [];
  player.capacity = heartCapacity(player.equipment.heartItem, player.stats.energyCapacityBonus);
  player.energy = player.capacity;
  player.meleeWait = 0; player.rangedWait = 0; player.heartWait = player.equipment.heartItem?.interval ?? data.config.heart.interval;
}

export function applyCharacterBuild(player: Player, build: CharacterBuild, growth?: CharacterPoints): void {
  const stats = calculateCharacterStats(build, growth);
  player.baseStats = { ...stats }; player.stats = stats; player.maxHp = stats.maxHp; player.hp = stats.maxHp; player.capacity = heartCapacity(player.equipment.heartItem, stats.energyCapacityBonus); player.energy = player.capacity;
}

export function createSimulation(options: { config: SimConfig; arena: Arena; random: () => number }): Simulation {
  return { ...options, experienceOrbs: [], waveSchedules: [], spawnHistory: [], waveBossPlanned: false, spawnIssued: 0, defeated: [], waveQueue: [], hazards: [], poisonWait: {}, players: [], enemies: [], projectiles: [], effects: [], elapsed: 0, clock: 0, spawnWait: 0, spawned: 0, nextId: 0, round: 1, finished: false, success: false, presentationOnly: false, partySize: 1, castHits: {} };
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
      player.blocking = false; player.dashLeft = 0; resetGuard(player);
    });
  }
  planWave(sim);
}

export function revivePlayer(sim: Simulation, player: Player): void {
  if (sim.finished || player.hp > 0 || player.reviveRemaining > 0 || !player.connected) return;
  const living = sim.players.some(item => item.hp > 0);
  if (!living && !(sim.preparing && sim.config.expedition)) return;
  player.hp = player.maxHp; player.energy = player.capacity;
  for (const ability of player.abilityStates) ability.remaining = 0;
  player.meleeWait = 0; player.rangedWait = 0; player.dashLeft = 0; player.blocking = false; resetGuard(player);
}

export function recoverInHall(sim: Simulation): void {
  sim.enemies = []; sim.projectiles = []; sim.effects = []; sim.hazards = []; sim.poisonWait = {};
  for (const player of sim.players) {
    player.hp = player.maxHp; player.energy = player.capacity; player.banners = undefined;
    player.meleeWait = 0; player.rangedWait = 0; player.heartWait = player.equipment.heartItem?.interval ?? sim.config.heart.interval;
    for (const ability of player.abilityStates) ability.remaining = 0; player.dashCooldown = 0;
    player.blocking = false; player.dashLeft = 0; resetGuard(player);
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
function hurtEnemy(sim: Simulation, event: { counterEligible?: boolean; chainDepth?: number; enemy: Enemy; player?: Player; damage: number; source?: Vec; bypassShield?: boolean; flavor?: string; castId?: string }): void {
  if (event.enemy.hp <= 0 || event.enemy.state === 'detonating') return;
  if (sim.presentationOnly) return;
  const protector = protectedBy(sim, event.enemy);
  const bannerBonus = event.player ? bannerDamage(event.player, event) : 1;
  const counter = event.counterEligible === false ? 1 : counterDamage(event.player);
  let damage = event.damage * bannerBonus * counter * (protector ? .4 : 1);
  const source = event.source ?? event.player;
  if (enemyShielded(event.enemy) && source && !event.bypassShield) {
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
    event.enemy.killerId = event.player?.id;
    if (event.enemy.definition.behavior === 'bomb') {
      event.enemy.hp = 1; event.enemy.state = 'detonating'; event.enemy.timer = event.enemy.definition.windup;
      const ability = enemyAbilities(event.enemy); ability.windup = event.enemy.definition.windup;
      event.enemy.chainDepth = event.chainDepth ?? 0;
      event.enemy.attackCount = (event.enemy.attackCount ?? 0) + 1; event.enemy.killerId = event.player?.id;
      return;
    }
    transferDeathMarks(sim, event.enemy);
    if (event.player) { event.player.kills += 1; awardCombatGrowth(sim, event.player, true); const reward = { enemy: event.enemy, kill: true }; dropCombatExperience(sim, event.player, reward); } event.enemy.state = 'dead';
    if (event.player && !event.enemy.parentId) sim.defeated.push(event.enemy);
    for (const player of sim.players) {
      const contribution = event.enemy.contributors?.[player.id];
      if (player.id !== event.player?.id && contribution !== undefined && sim.clock - contribution <= 15) { player.assists += 1; awardCombatGrowth(sim, player, false); const reward = { enemy: event.enemy, kill: false }; dropCombatExperience(sim, player, reward); }
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
    resetGuard(player);
    player.meleeState = '灵魂状态'; player.rangedState = '灵魂状态';
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
  stepGuard(player, dt);
  prepareRhythm(sim, player, dt);
  player.heartWait -= dt;
  const heart = player.equipment.heartItem;
  if (heart && player.heartWait <= 0) {
    const recovery = heartRecovery(player); player.heartWait += recovery.interval;
    const bonus = player.growth.includes('energy') ? 1.25 : 1;
    const resonance = resonanceState(player);
    const extra = heart.effect === 'cycle' ? resonance.energyBoost : 0;
    const baseRecovery = recovery.amount * bonus + extra; const bannerExtra = bannerRecovery(player, baseRecovery);
    const room = player.capacity - player.energy; const baseline = Math.min(baseRecovery, room);
    const amount = Math.min(baseRecovery + bannerExtra, room);
    if (amount > 0) {
      player.energy += amount; spendBannerRecovery(player, amount - baseline);
      if (extra > 0) resonance.energyBoost = 0;
      if ((resonance.recoveryCharges ?? 0) > 0) resonance.recoveryCharges = (resonance.recoveryCharges ?? 0) - 1;
      const heartId = heart.definitionId ?? heart.id;
      const flavor = heart.effect === 'cycle' ? 'cycle' : heartId.endsWith('/spring') ? 'spring' : heartId.endsWith('/ocean') ? 'ocean' : 'stream';
      const stamp = sim.clock.toFixed(3);
      const effect = { level: heart.level ?? 1, empowered: extra > 0 || recovery.empowered, id: `recover-${player.id}-${stamp}`, owner: player.id, x: player.x, y: player.y, radius: 1, kind: `ability-recover-${flavor}`, duration: .65 };
      if (!sim.presentationOnly) addEffect(sim, effect);
    }
  }
  for (const skillType of ['melee', 'ranged']) {
    for (const branch of player.equipment.branches) {
      if (branch.item.skillType !== skillType) continue;
      let state = player.abilityStates.find(item => item.itemId === branch.item.id);
      if (!state) { state = { itemId: branch.item.id, remaining: 0, count: 0, state: '就绪' }; player.abilityStates.push(state); }
      const event = { branch, state, dt };
      abilityStep(sim, player, event);
    }
  }
  const melee = player.equipment.branches.find(branch => branch.item.skillType === 'melee');
  const skill = player.equipment.branches.find(branch => branch.item.skillType === 'ranged');
  const meleeState = player.abilityStates.find(item => item.itemId === melee?.item.id);
  const rangedState = player.abilityStates.find(item => item.itemId === skill?.item.id);
  player.meleeWait = meleeState?.remaining ?? 0; player.rangedWait = rangedState?.remaining ?? 0;
  player.meleeState = meleeState?.state ?? '未装备'; player.rangedState = rangedState?.state ?? '未装备';
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
  const owner = sim.players.find(player => player.id === shot.owner); const wind = owner ? bannerBuff(owner, 'banner-wind') : undefined;
  const turning = wind && wind.level >= 15 ? 10 : 8;
  const shortest = Math.atan2(sine, cosine); const turn = clamp(shortest, -turning * dt, turning * dt); const angle = current + turn;
  shot.vx = Math.cos(angle) * speed; shot.vy = Math.sin(angle) * speed;
}
function abilityStep(sim: Simulation, player: Player, event: { branch: Player['equipment']['branches'][number]; state: AbilityState; dt: number }): void {
  const { branch, state, dt } = event; const item = branch.item;
  state.remaining = Math.max(0, state.remaining - dt);
  if (isBanner(item.effect)) { const cast = { branch, state }; bannerCast(sim, player, cast); return; }
  const progress = abilityProgress(state);
  const level = item.level ?? 1; const evolved = level >= 5; const mastery = level >= 10;
  const baseRange = item.effect === 'spear' ? mastery ? 3.6 : evolved ? 3.3 : item.range ?? 3 : item.range ?? 0;
  const sweepReady = item.effect === 'slash' && level >= 15 && progress.landed >= 3;
  const range = item.skillType === 'melee' ? (baseRange + (sweepReady ? .35 : 0)) * branch.areaMultiplier : baseRange;
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
  const melee = item.skillType === 'melee';
  const attack = melee ? player.stats.physicalAttack : player.stats.magicalAttack;
  const empowered = consumeResonance(player, item.skillType ?? 'ranged');
  const damage = (1 + empowered) * ((item.damage ?? 0) + attack * (item.coefficient ?? 0)) * branch.damageMultiplier * modifiers.damage;
  player.energy -= cost; state.remaining = attackInterval(player, branch, state); state.count += 1; state.state = '已触发';
  if (melee) player.meleeCount += 1; else player.rangedCount += 1;
  const id = `${player.id}-${item.id}-${state.count}`;
  const overloaded = modifiers.overloaded; progress.spent = modifiers.saved; commitCast(player, branch, state);
  if (overloaded) progress.overloadCast = state.count;
  const novel = { player, branch, target, damage, id, state, cost }; const novelActions = { hurt: hurtEnemy };
  if (castNovel(sim, novel, novelActions)) return;
  const delta = { x: target.x - player.x, y: target.y - player.y }; const aim = unit(delta);
  if (melee) {
    const wind = bannerWind(player); const delay = .12 / wind;
    const pending: Effect = { id: `windup-${id}`, groupId: id, owner: player.id, sourceId: item.id, level, x: player.x, y: player.y, facingX: aim.x, facingY: aim.y, radius: range, damage, kind: 'ability-melee-windup', duration: delay + .1, ttl: delay + .1, delay, melee: { count: state.count, range, empowered, overloaded, target: target.id } };
    sim.effects.push(pending); return;
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
    const projectile: Projectile = { homing: branch.supportLevels.homing, overload: overloaded ? branch.supportLevels.overload : 0, areaLevel: branch.supportLevels.area ?? 0, areaScale: branch.areaMultiplier, level, fork: branch.fork, spread: branch.spread, echo: branch.echo, returnable: item.effect === 'blade' && mastery, originX: player.x, originY: player.y, bounces: item.effect === 'star' ? mastery ? 2 : evolved ? 1 : 0 : 0, sourceId: item.id, resonance: empowered > 0 ? 0 : branch.resonance, empowered: empowered > 0, markDuration: mastery ? 8 : 6, id: `shot-${id}-${index}`, castId: id, effect: item.effect, targetId, travel: 0, x: player.x, y: player.y, owner: player.id, vx, vy, ttl: range / projectileSpeed * (multiple >= 10 && side ? 1.2 : 1), damage: damage * (multiple >= 15 && side ? 1.1 : 1), pierces: item.effect === 'blade' ? mastery ? 4 : evolved ? 3 : 2 : item.effect === 'thunder-seal' && mastery ? 2 : 1, hitIds: [], blast, slow: item.effect === 'frost' ? mastery ? .35 : .25 : 0, slowDuration: mastery ? 3 : 2, bounce: item.effect === 'star' && evolved };
    initializeHoming(sim, projectile);
    sim.projectiles.push(projectile);
    const cadence = branch.unleash >= 3 ? 3 : 4;
    if (branch.unleash && (state.count - progress.origin) % cadence === 0) {
      const repeats = branch.unleash >= 5 ? 2 : 1;
      for (let repeat = 1; repeat <= repeats; repeat += 1) {
        const delayed: Projectile = { ...projectile, homingTravel: 0, id: `${projectile.id}-unleash-${repeat}`, castId: `${id}-unleash-${repeat}`, targetId: target.id, releaseLevel: branch.unleash, releaseGroup: `${id}-release`, releaseAngle: angle, delay: repeat * (branch.unleash >= 15 ? .12 : .18), damage: damage * .45, secondary: true, resonance: 0, overload: 0, areaLevel: 0, fork: 0, spread: 0, echo: 0, returnable: false, hitIds: [] };
        sim.projectiles.push(delayed);
      }
    }
  }
}

function executeMeleeSkill(sim: Simulation, player: Player, castEffect: Effect): void {
  const pending = castEffect.melee; if (!pending) return;
  const branch = player.equipment.branches.find(entry => entry.item.id === castEffect.sourceId);
  const actual = player.abilityStates.find(entry => entry.itemId === castEffect.sourceId);
  const target = sim.enemies.find(entry => entry.id === pending.target && entry.hp > 0);
  if (!branch || !actual || !target || player.hp <= 0 || player.blocking) return;
  const state = { ...actual, count: pending.count }; const item = branch.item; const progress = abilityProgress(actual);
  const level = castEffect.level ?? 1; const evolved = level >= 5; const mastery = level >= 10;
  const range = pending.range; const empowered = pending.empowered; const overloaded = pending.overloaded;
  const damage = castEffect.damage ?? 0; const id = castEffect.groupId ?? castEffect.id;
  const sweepReady = item.effect === 'slash' && level >= 15 && progress.landed >= 3;
  const aim = { x: castEffect.facingX ?? 0, y: castEffect.facingY ?? 1 };
    const sweepSkill = item.effect === 'slash' || item.effect === 'thunder-staff';
    const finisher = item.effect === 'dual' && evolved && (state.count - progress.origin) % (mastery ? 3 : 4) === 0;
    const angle = finisher ? mastery ? 120 : 90 : sweepSkill && evolved ? mastery ? 180 : 150 : item.angle ?? 120;
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
        const hit = { kind: 'melee', sourceId: item.id, resonance: empowered > 0 ? 0 : branch.resonance };
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
    const actionSpeed = bannerWind(player);
    const effect = { charged: overloaded, level, sourceId: item.id, swing: state.count % 2, angle, width: (mastery ? 1.1 : evolved ? .9 : item.width ?? .7) * branch.areaMultiplier, owner: player.id, empowered: empowered > 0, id: `melee-${id}`, x: player.x, y: player.y, radius: range, facingX: aim.x, facingY: aim.y, duration: .28 / actionSpeed, kind: circle ? item.effect === 'slash' ? 'ability-slash-circle' : 'ability-hammer-circle' : finisher ? 'ability-dual-cross' : `ability-${item.effect ?? 'slash'}` }; addEffect(sim, effect);
    if (branch.echo && item.effect === 'hammer') {
      const echo = { id, owner: player.id, sourceId: item.id, x: player.x + aim.x * range * .5, y: player.y + aim.y * range * .5, radius: range * .65, damage, level: branch.echo }; aftershock(sim, echo);
    }

  actual.remaining = Math.min(actual.remaining, state.remaining);
}
function stepMelee(sim: Simulation, dt: number, localPlayerId?: string): void {
  const pending = sim.effects.filter(effect => effect.kind === 'ability-melee-windup' && effect.ttl > 0);
  for (const effect of pending) {
    if (sim.presentationOnly && localPlayerId && effect.owner !== localPlayerId) continue;
    effect.delay = Math.max(0, (effect.delay ?? 0) - dt); if (effect.delay > 0) continue;
    effect.ttl = 0; const player = sim.players.find(entry => entry.id === effect.owner);
    if (player) executeMeleeSkill(sim, player, effect);
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
      const hit = { kind: 'ranged', sourceId: shot.sourceId ?? '', resonance: shot.resonance ?? 0 };
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
  return enemyCombatArea(enemy);
}
function contactDamage(sim: Simulation): void {
  if (sim.presentationOnly) return;
  for (const player of sim.players) {
    if (player.hp <= 0 || (player.contactNextAt ?? 0) > sim.clock) continue;
    let touching: Enemy | undefined;
    for (const enemy of sim.enemies) {
      if (enemy.hp <= 0 || enemy.state === 'detonating' || enemy.state === 'escaped') continue;
      if (enemy.definition.behavior === 'squirrel' || enemy.definition.behavior === 'protector' || enemy.definition.behavior === 'brood') continue;
      if (enemy.state !== 'chase') continue;
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
  const rawDamage = hit.damage * 100 / (100 + player.stats.physicalDefense);
  const guard = guardHit(player, rawDamage);
  const guarded = guard.kind !== 'hurt';
  const protection = guard.damage > 0 ? bannerGuard(player, guard.damage) : { damage: 0, absorbed: 0 }; const damage = protection.damage;
  const absorbed = Math.min(player.lootShield, damage); player.lootShield -= absorbed;
  const actual = Math.min(player.hp, damage - absorbed);
  player.hp = Math.max(0, player.hp - actual);
  if (player.hp === 0) { resetGuard(player); player.reviveRemaining = sim.config.revivalSeconds ?? 15; player.blocking = false; player.dashLeft = 0; player.meleeState = '灵魂状态'; player.rangedState = '灵魂状态'; }
  if (guarded) player.blocked += 1;
  const effect: Effect = { id: `impact-${sim.nextId + 1}`, ttl: .5, duration: .5, targetId: player.id, targetKind: 'player', damage: actual, absorbed: absorbed + protection.absorbed, killed: player.hp <= 0, facingX: -direction.x, facingY: -direction.y, x: player.x, y: player.y, radius: .5, kind: guarded ? guard.kind : actual <= 0 ? 'absorb' : 'hurt' }; addEffect(sim, effect);
}
function segmentDistance(point: Vec, segment: { from: Vec; to: Vec }): number {
  const dx = segment.to.x - segment.from.x; const dy = segment.to.y - segment.from.y; const squared = dx * dx + dy * dy;
  const projection = squared === 0 ? 0 : ((point.x - segment.from.x) * dx + (point.y - segment.from.y) * dy) / squared;
  const t = clamp(projection, 0, 1); const nearest = { x: segment.from.x + dx * t, y: segment.from.y + dy * t };
  return distance(point, nearest);
}
function explodeEnemy(sim: Simulation, enemy: Enemy): void {
  const effect = { id: `${enemy.id}-explosion-${enemy.attackCount}`, x: enemy.x, y: enemy.y, radius: enemy.definition.reach, kind: 'enemy-blast', duration: .55 }; addEffect(sim, effect);
  if (!sim.presentationOnly) {
    const area = enemyAttackArea(enemy);
    const owner = sim.players.find(player => player.id === enemy.killerId);
    for (const player of sim.players) {
      const separation = distance(player, enemy);
      if (separation <= area.radius + .4) { const hit = { source: enemy, damage: enemy.definition.damage }; hurtPlayer(sim, player, hit); }
    }
    for (const victim of sim.enemies) {
      if (victim === enemy || victim.hp <= 0) continue;
      if (victim.definition.behavior === 'bomb' && (enemy.chainDepth ?? 0) >= 2) continue;
      const separation = distance(victim, enemy);
      if (separation <= area.radius + victim.radius) { const hit = { counterEligible: false, enemy: victim, player: owner, damage: enemy.definition.damage * 3, source: enemy, bypassShield: true, chainDepth: (enemy.chainDepth ?? 0) + 1 }; hurtEnemy(sim, hit); }
    }
    if (owner) { owner.kills += 1; awardCombatGrowth(sim, owner, true); const reward = { enemy, kill: true }; dropCombatExperience(sim, owner, reward); if (!enemy.parentId) sim.defeated.push(enemy); }
    for (const player of sim.players) {
      const contribution = enemy.contributors?.[player.id];
      if (player !== owner && contribution !== undefined && sim.clock - contribution <= 15) { player.assists += 1; awardCombatGrowth(sim, player, false); const reward = { enemy, kill: false }; dropCombatExperience(sim, player, reward); }
    }
    enemy.hp = 0; transferDeathMarks(sim, enemy);
  }
  enemy.state = 'spent';
}
function enemyStep(sim: Simulation, enemy: Enemy, dt: number): void {
  if (enemy.hp <= 0 || enemy.state === 'spent' || enemy.state === 'escaped') return;
  if (enemy.expiresAt !== undefined && sim.clock >= enemy.expiresAt) { enemy.hp = 0; enemy.state = 'escaped'; return; }
  const context = { dt, actions: enemyActions };
  const handled = stepEnemyTactic(sim, enemy, context);
  if (!handled) stepEnemyCombat(sim, enemy, context);
}
const enemyActions: EnemyActions = { move, legal, hurt: hurtPlayer, effect: addEffect, detonate: explodeEnemy };

export function step(sim: Simulation, dt: number, localPlayerId?: string): void {
  if (sim.finished) {
    settleClaimedExperience(sim);
    sim.effects = sim.effects.filter(effect => !effect.kind.startsWith('banner-'));
    for (const player of sim.players) player.banners = undefined;
    return;
  }
  if (sim.preparing) {
    sim.clock += dt; stepExperience(sim);
    for (const effect of sim.effects) if (effect.kind === 'experience-absorb') effect.ttl -= dt;
    sim.effects = sim.effects.filter(effect => effect.ttl > 0);
    sim.effects = sim.effects.filter(effect => !effect.kind.startsWith('banner-') && !effect.melee);
    for (const player of sim.players) player.banners = undefined;
    if (!sim.presentationOnly && !sim.config.expedition && sim.players.every(player => player.hp <= 0)) { settleClaimedExperience(sim); sim.finished = true; sim.success = false; return; }
    for (const player of sim.players) {
      if (player.hp <= 0) player.reviveRemaining = Math.max(0, player.reviveRemaining - dt);
      const fresh = player.connected && sim.clock - player.inputAt <= .6;
      if (fresh && !player.clientDriven) {
        const direction = unit(player.input);
        const movement = { x: direction.x * player.stats.movementSpeed * dt, y: direction.y * player.stats.movementSpeed * dt, radius: .4 };
        move(sim, player, movement);
        if (direction.x || direction.y) { player.facingX = direction.x; player.facingY = direction.y; }
      }
      player.input.dash = false; player.blocking = false; stepGuard(player, dt);
    }
    return;
  }
  if (!sim.presentationOnly) {
    const wiped = sim.players.every(player => player.hp <= 0);
    if (wiped) { settleClaimedExperience(sim); sim.finished = true; sim.success = false; return; }
    for (const player of sim.players) player.survivalSeconds += dt;
  }
  sim.elapsed += dt; sim.clock += dt;
  const timedWave = expeditionWave(sim.config, sim.round);
  if (!sim.presentationOnly && sim.config.expedition && timedWave && sim.elapsed >= timedWave.interval) {
    sim.elapsed = timedWave.interval; clearExpeditionCombat(sim); return;
  }
  stepExperience(sim);
  const spawnActions = { legal }; spawnWaveBatch(sim, spawnActions);
  stepBanners(sim, dt, localPlayerId);
  for (const player of sim.players) {
    if (!sim.presentationOnly || !localPlayerId || player.id === localPlayerId) playerStep(sim, player, dt);
    else if (sim.clock - player.inputAt <= .2) {
      const direction = unit(player.input); const movement = { x: direction.x * player.stats.movementSpeed * dt, y: direction.y * player.stats.movementSpeed * dt, radius: .4 };
      move(sim, player, movement);
    }
  }
  stepMelee(sim, dt, localPlayerId);
  if (!sim.presentationOnly || !localPlayerId) for (const enemy of sim.enemies) enemyStep(sim, enemy, dt);
  if (!sim.presentationOnly) contactDamage(sim);
  if (!sim.presentationOnly) {
    const wiped = sim.players.every(player => player.hp <= 0);
    if (wiped) { settleClaimedExperience(sim); sim.finished = true; sim.success = false; return; }
  }
  let grid = collisionGrids.get(sim);
  if (!grid) { grid = new SpatialEnemies(); collisionGrids.set(sim, grid); }
  const homingActive = sim.projectiles.some(shot => (shot.homing ?? 0) > 0);
  if (!sim.presentationOnly || homingActive) grid.rebuild(sim.enemies);
  const projectilesAtStart = sim.projectiles.length;
  const releaseTargets = new Map<string, Enemy | undefined>();
  for (let shotIndex = 0; shotIndex < projectilesAtStart; shotIndex += 1) {
    const shot = sim.projectiles[shotIndex];
    if (shot.ttl <= 0) continue;
    if ((shot.delay ?? 0) > 0) {
      const owner = sim.players.find(player => player.id === shot.owner);
      const branch = owner?.equipment.branches.find(entry => entry.item.id === shot.sourceId);
      if (!owner || owner.hp <= 0 || !branch) { shot.ttl = 0; continue; }
      shot.delay = Math.max(0, (shot.delay ?? 0) - dt); if (shot.delay > 0) continue;
      shot.x = owner.x; shot.y = owner.y;
      if (shot.releaseLevel) {
        const batch = shot.castId ?? shot.id; const key = shot.releaseGroup ?? batch;
        if (!releaseTargets.has(batch)) {
          const selected = shot.releaseLevel >= 20 ? sim.castHits[key]?.ids[0] ?? shot.targetId : shot.targetId;
          const range = branch.item.range ?? 9;
          let target = sim.enemies.find(enemy => {
            if (enemy.id !== selected || enemy.hp <= 0 || enemy.state === 'detonating' || enemy.state === 'escaped') return false;
            const separation = distance(enemy, owner); return separation <= range;
          });
          if (!target && shot.releaseLevel >= 10) target = nearest(sim, owner, range);
          releaseTargets.set(batch, target);
          if (target && shot.releaseLevel >= 20) sim.castHits[key] = { ids: [target.id], until: sim.clock + 8 };
        }
        const target = releaseTargets.get(batch);
        if (!target) { shot.ttl = 0; continue; }
        shot.targetId = target.id;
        const angle = Math.atan2(target.y - owner.y, target.x - owner.x) + (shot.releaseAngle ?? 0);
        const speed = Math.hypot(shot.vx, shot.vy);
        shot.vx = Math.cos(angle) * speed; shot.vy = Math.sin(angle) * speed;
        initializeHoming(sim, shot);
      }
    }
    bannerFlight(sim, shot);
    if (shot.effect === 'star') guideStar(sim, shot, dt);
    if (shot.homing && !shot.returning && !shot.hostile) {
      const settings = homingStats(shot.homing);
      const lower = { x: shot.x - settings.range, y: shot.y - settings.range };
      const upper = { x: shot.x + settings.range, y: shot.y + settings.range };
      const candidates = grid.segment(lower, upper);
      const guidance = { dt, candidates };
      guideHoming(sim, shot, guidance);
    }
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
    if (sim.presentationOnly) continue;
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
    const nearby = grid.segment(from, shot);
    for (const enemy of nearby) {
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
  if (!sim.presentationOnly) {
    const bannerActions = { hurt: hurtEnemy, legal, segmentDistance, enemies: grid };
    stepBannerCombat(sim, dt, bannerActions);
    const evolutionActions = { hurt: hurtEnemy }; stepEvolution(sim, dt, evolutionActions); stepNovel(sim, dt, evolutionActions);
  }
  for (const enemy of sim.enemies) {
    for (const owner of Object.keys(enemy.thunderResiduals ?? {})) { if (enemy.thunderResiduals) enemy.thunderResiduals[owner] = Math.max(0, enemy.thunderResiduals[owner] - dt); }
    for (const [owner, mark] of Object.entries(enemy.thunderMarks ?? {})) {
      mark.remaining -= dt;
      if (mark.remaining <= 0) delete enemy.thunderMarks?.[owner];
    }
  }
  if (!sim.presentationOnly) stepEnemyHazards(sim, dt, enemyActions);
  else for (const hazard of sim.hazards) hazard.age += dt;
  for (const [id, hit] of Object.entries(sim.castHits)) if (hit.until < sim.clock) delete sim.castHits[id];
  if (!sim.presentationOnly) { const novelDeathActions = { hurt: hurtEnemy }; stepNovel(sim, 0, novelDeathActions); }
  sim.projectiles = sim.projectiles.filter(shot => shot.ttl > 0); sim.enemies = sim.enemies.filter(enemy => enemy.hp > 0);
  for (const effect of sim.effects) effect.ttl -= dt;
  sim.effects = sim.effects.filter(effect => effect.ttl > 0);
  if (sim.presentationOnly) return;
  const wiped = sim.players.every(player => player.hp <= 0);
  if (wiped) { settleClaimedExperience(sim); sim.finished = true; sim.success = false; }
}



export * from './battle-state';
