export * from './expedition';
import { expeditionDifficultySchema, expeditionViewSchema, expeditionOutcomeSchema } from './expedition';
import type { ExpeditionViewData } from './expedition';
export * from './loot';
import { lootItemSchema, experienceOrbSchema } from './loot';
import type { LootItemData, ExperienceOrbData } from './loot';
export * from './test-tools';
export * from './inventory';
export * from './tutorial';
import { z } from 'zod';

export const protocolVersion = '24';

const equipmentId = z.string().min(1).max(100);
const equipmentSocket = equipmentId.nullable();
const equipmentBranchFields = { itemId: equipmentId, supports: z.array(equipmentSocket).max(12) };
const equipmentBranchSchema = z.object(equipmentBranchFields).strict();
const optionalEquipmentBranch = equipmentBranchSchema.nullable();
const equipmentLoadoutFields = { heart: equipmentSocket, slots: z.array(optionalEquipmentBranch).max(12) };
export const equipmentLoadoutSchema = z.object(equipmentLoadoutFields).strict();
export type EquipmentLoadoutData = z.infer<typeof equipmentLoadoutSchema>;

const buildItemFields = { experience: z.number().int().min(0).max(499).optional(), id: equipmentId, definitionId: equipmentId, level: z.number().int().min(1).max(20), bonus: z.number().int().min(0).max(19) };
export const buildItemSchema = z.object(buildItemFields).strict();
export type BuildItemData = z.infer<typeof buildItemSchema>;
const growthOptionFields = { kind: z.enum(['upgrade', 'item', 'refine', 'character']), itemId: equipmentId, level: z.number().int().min(1).max(20) };
const growthOptionSchema = z.object(growthOptionFields).strict();
const growthChoiceFields = { hellEntry: z.boolean().optional(), refreshCount: z.number().int().nonnegative().default(0), earnedLevel: z.number().int().optional(), wave: z.number().int().positive().optional(), keyWave: z.boolean().optional(), id: z.number().int(), source: z.enum(['level', 'wave', 'link']), options: z.array(growthOptionSchema).min(1).max(3) };
const growthChoiceSchema = z.object(growthChoiceFields).strict();
const rankValue = z.number().int().nonnegative();
const rankKey = z.string();
const characterRanksSchema = z.record(rankKey, rankValue);
const buildStateFields = { characterLevel: z.number().int().min(1).max(20).default(1), coinsEarned: z.number().int().nonnegative().default(0), coinsSpent: z.number().int().nonnegative().default(0), characterRanks: characterRanksSchema.default({}), revision: z.number().int(), level: z.number().int(), experience: z.number(), required: z.number(), upgradeCredits: z.number().int(), waveCredits: z.number().int(), items: z.array(buildItemSchema).max(120), loadout: equipmentLoadoutSchema, choices: z.array(growthChoiceSchema) };
export const buildStateSchema = z.object(buildStateFields).strict();
export type BuildStateData = z.infer<typeof buildStateSchema>;
const chooseGrowthFields = { targetId: equipmentId.optional(), choiceId: z.number().int().nonnegative(), index: z.number().int().min(0).max(2) };
export const chooseGrowthSchema = z.object(chooseGrowthFields).strict();

const equipmentStateFields = { characterLevel: z.number().int().min(1).max(20).default(1), coins: z.number().int().nonnegative().default(0), previousLoadout: equipmentLoadoutSchema.nullable().default(null), copyBaseCoins: z.number().int().nonnegative().default(0), copyCoins: z.number().int().nonnegative().default(0), copyError: z.string().default(''), loadout: equipmentLoadoutSchema, ownedIds: z.array(equipmentId).max(103), items: z.array(buildItemSchema).max(103), revision: z.number().int().nonnegative() };
export const equipmentStateSchema = z.object(equipmentStateFields).strict();
export type EquipmentStateData = z.infer<typeof equipmentStateSchema>;
const equipmentSaveFields = { loadout: equipmentLoadoutSchema, revision: z.number().int().nonnegative() };
export const equipmentSaveSchema = z.object(equipmentSaveFields).strict();

const credentialsFields = { name: z.string().trim().min(2).max(20).regex(/^[\p{L}\p{N}_-]+$/u), password: z.string().min(8).max(72) };
export const credentialsSchema = z.object(credentialsFields).strict();
const characterPoint = z.number().int().min(0).max(24);
const characterPointFields = { power: characterPoint, magic: characterPoint, vitality: characterPoint, spirit: characterPoint, movement: characterPoint, haste: characterPoint, luck: characterPoint };
const characterPointsSchema = z.object(characterPointFields).strict();
const growthPoint = z.number().int().min(0).max(19);
const characterGrowthFields = { power: growthPoint, magic: growthPoint, vitality: growthPoint, spirit: growthPoint, movement: growthPoint, haste: growthPoint, luck: growthPoint };
export const characterGrowthSchema = z.object(characterGrowthFields).strict();
export type CharacterGrowthData = z.infer<typeof characterGrowthSchema>;
const defaultCharacterGrowth: CharacterGrowthData = { power: 0, magic: 0, vitality: 0, spirit: 0, movement: 0, haste: 0, luck: 0 };
const characterBuildFields = { name: z.string().trim().min(1).max(20), description: z.string().trim().max(120), points: characterPointsSchema, talents: z.array(z.string().min(1).max(30)).max(10) };
export const characterBuildSchema = z.object(characterBuildFields).strict();
export type CharacterBuildData = z.infer<typeof characterBuildSchema>;
const characterCreationFields = { role: z.literal('forest-survival:character/ranger'), character: characterBuildSchema.optional() };
export const characterCreationSchema = z.object(characterCreationFields).strict();
const characterStatsFields = { maxHp: z.number().positive(), energyCapacityBonus: z.number(), physicalAttack: z.number().positive(), magicalAttack: z.number().positive(), physicalDefense: z.number().nonnegative(), magicalDefense: z.number().nonnegative(), movementSpeed: z.number().positive(), attackSpeed: z.number().positive(), castingSpeed: z.number().positive(), luck: z.number().min(0).max(100) };
export const characterStatsSchema = z.object(characterStatsFields).strict();
export type CharacterStatsData = z.infer<typeof characterStatsSchema>;
const motionFields = { x: z.number().min(0).max(10000), y: z.number().min(0).max(10000), facingX: z.number().min(-1).max(1), facingY: z.number().min(-1).max(1) };
const motionSchema = z.object(motionFields).strict();
const inputFields = { blockPress: z.number().int().nonnegative().max(2147483647).optional(), sequence: z.number().int().nonnegative().max(2147483647), x: z.number().min(-1).max(1), y: z.number().min(-1).max(1), block: z.boolean(), dash: z.boolean(), position: motionSchema.optional() };
export const inputSchema = z.object(inputFields).strict();
export const growthSchema = z.enum(['power', 'energy', 'vitality']);
const joinFields = { difficulty: expeditionDifficultySchema.default('normal'), token: z.string().min(20).max(200), protocol: z.literal(protocolVersion) };
export const joinSchema = z.object(joinFields).strict();
export type Input = z.infer<typeof inputSchema>;
export type Growth = z.infer<typeof growthSchema>;
export type Stage = 'waiting' | 'rest' | 'combat' | 'round-result' | 'settling' | 'final-result';
export interface Profile { characterGrowth?: CharacterGrowthData; characterGrowthRevision?: number; characterLevel?: number; loadout?: EquipmentLoadoutData | null; id: string; name: string; role: string | null; coins: number; materials: number; character?: CharacterBuildData | null }
const abilityProgressSchema = z.object({ origin: z.number(), spent: z.boolean(), idle: z.number(), started: z.boolean(), starved: z.number(), released: z.boolean(), stacks: z.number(), quiet: z.number(), charges: z.number(), overload: z.number(), overloadCast: z.number(), landed: z.number(), retain: z.number(), staff: z.number() });
export type AbilityProgressView = z.infer<typeof abilityProgressSchema>;
const heartProgressSchema = z.object({ cooldown: z.number(), low: z.number(), burst: z.number(), idle: z.number() });
export type HeartProgressView = z.infer<typeof heartProgressSchema>;
export interface AbilityView { progress?: AbilityProgressView; id: string; name: string; kind: 'skill'; skillType: 'melee' | 'ranged'; icon: string; interval: number; remaining: number; cost: number; state: string; triggers: number }
const resonanceFields = { supportLevel: z.number().optional(), relayCount: z.number().optional(), relayLeft: z.number().optional(), finisher: z.boolean().optional(), cycleCount: z.number().optional(), recoveryCharges: z.number().optional(), lastKind: z.string(), lastAge: z.number(), energyBoost: z.number(), cooldown: z.number(), buffKind: z.string(), buffPower: z.number(), buffLeft: z.number(), buffSource: z.string() };
const resonanceSchema = z.object(resonanceFields);
export type ResonanceView = z.infer<typeof resonanceSchema>;
const thunderMarkSchema = z.object({ residual: z.boolean().optional(), charged: z.boolean().optional(), transfer: z.boolean().optional(), remaining: z.number().nonnegative(), power: z.number().nonnegative() });
const thunderMarksSchema = z.record(z.string(), thunderMarkSchema);
export type ThunderMarksView = z.infer<typeof thunderMarksSchema>;
const bannerFieldSchema = z.object({ attackEpoch: z.number().nonnegative().optional(), attackCycle: z.number().int().min(-1).optional(), attacks: z.number().int().nonnegative().optional(), strength: z.number(), linger: z.number(), lingerFactor: z.number(), tail: z.number(), warmup: z.number(), levels: z.record(z.string(), z.number()) });
const bannerBuffSchema = z.object({ counter: z.boolean().optional(), kind: z.string(), sourceId: z.string(), owner: z.string(), fieldId: z.string(), strength: z.number(), level: z.number(), remaining: z.number(), linger: z.number(), lingerFactor: z.number(), inside: z.boolean(), held: z.number(), charge: z.number(), entryWait: z.number(), pulseWait: z.number(), shieldWait: z.number(), shield: z.number(), resist: z.number(), x: z.number(), y: z.number(), lastCast: z.string(), castPower: z.number() });
const bannerStateSchema = z.object({ buffs: z.array(bannerBuffSchema).max(5), selfBudget: z.number() });
const meleeCastSchema = z.object({ count: z.number(), range: z.number(), empowered: z.number(), overloaded: z.boolean(), target: z.string() });
export type BannerFieldView = z.infer<typeof bannerFieldSchema>;
export type BannerStateView = z.infer<typeof bannerStateSchema>;
export type MeleeCastView = z.infer<typeof meleeCastSchema>;
export interface GuardView { windowLeft: number; counterLeft: number; press: number; held: boolean; triggered: boolean }
const guardFields = { windowLeft: z.number().min(0).max(.25), counterLeft: z.number().min(0).max(10), press: z.number().int().nonnegative(), held: z.boolean(), triggered: z.boolean() };
const guardSchema = z.object(guardFields);
export interface PlayerView { guard?: GuardView; level?: number; experience?: number; characterLevel?: number; banners?: BannerStateView; heartProgress?: HeartProgressView; hasteLeft?: number; focusLeft?: number; shieldLeft?: number; lootShield?: number; energyRecoveryBonus?: number; resonance?: ResonanceView; buildItems?: BuildItemData[]; buildRevision?: number; reviveRemaining: number; assists: number; loadout?: EquipmentLoadoutData; abilities?: AbilityView[]; survivalSeconds?: number; stats?: CharacterStatsData; id: string; name: string; x: number; y: number; facingX: number; facingY: number; hp: number; maxHp: number; energy: number; capacity: number; meleeWait: number; rangedWait: number; meleeState: string; rangedState: string; dashCooldown: number; blocking: boolean; connected: boolean; ready: boolean; growth: Growth[]; kills: number; damage: number; blocked: number; heartWait: number; dashLeft: number; dashX: number; dashY: number; meleeCount: number; rangedCount: number; sequence: number }
const enemyLinkIdSchema = z.string();
const enemyLinksSchema = z.array(enemyLinkIdSchema).max(2);
const enemyAbilityFields = { tier: z.number().int().min(0).max(3), phase: z.number().int().min(0).max(1), cycle: z.number().int().nonnegative(), step: z.number().int().nonnegative(), mode: z.string().max(30), windup: z.number().positive(), links: enemyLinksSchema, supportWait: z.number().finite() };
const enemyAbilitySchema = z.object(enemyAbilityFields);
export type EnemyAbilityView = z.infer<typeof enemyAbilitySchema>;
export interface EnemyView { abilities?: EnemyAbilityView; bornWave?: number; expiresAt?: number; thunderResiduals?: Record<string, number>; healthScale?: number; damageScale?: number; thunderMarks?: ThunderMarksView; slowUntil?: number; slowFactor?: number; id: string; kind: string; x: number; y: number; radius: number; hp: number; maxHp: number; state: string; facingX: number; facingY: number; timer: number; targetId: string; attackX?: number; attackY?: number; originX?: number; originY?: number; attackCount?: number; combo?: number; hitIds?: string[]; linkId?: string; linkWait?: number; parentId?: string; summonCount?: number; escapeLeft?: number }
export interface ProjectileView { homing?: number; homingTravel?: number; windScale?: number; overload?: number; areaLevel?: number; areaScale?: number; releaseLevel?: number; releaseGroup?: string; releaseAngle?: number; terminal?: boolean;  level?: number; fork?: number; spread?: number; echo?: number; delay?: number; returning?: boolean; returnable?: boolean; originX?: number; originY?: number; travel?: number; bounces?: number; secondary?: boolean;  sourceId?: string; resonance?: number; empowered?: boolean; markDuration?: number; effect?: string; targetId?: string; castId?: string; pierces?: number; hitIds?: string[]; blast?: number; slow?: number; slowDuration?: number; bounce?: boolean; id: string; x: number; y: number; owner: string; vx: number; vy: number; ttl: number; hostile?: boolean }
export interface EffectView { amount?: number; hitIds?: string[]; banner?: BannerFieldView; melee?: MeleeCastView; generation?: number; pulses?: number; paidCost?: number; resonancePower?: number;  charged?: boolean; edge?: boolean; innerRadius?: number; innerWidth?: number; shape?: string; slow?: number; groupId?: string; markPower?: number; markRemaining?: number; spreadCount?: number;  targetId?: string; targetKind?: 'player' | 'enemy'; damage?: number; absorbed?: number; killed?: boolean; flavor?: string; castId?: string; level?: number; swing?: number; angle?: number; width?: number; delay?: number; sourceId?: string; ring?: boolean;  owner?: string; empowered?: boolean; id: string; x: number; y: number; radius: number; kind: string; ttl: number; duration?: number; facingX?: number; facingY?: number }
export interface RoundResult { round: number; success: boolean; players: { participating?: boolean; id: string; kills: number; damage: number; survivalSeconds?: number; assists?: number; coinsEarned?: number; coinsSpent?: number; safe?: LootItemData[] }[] }
export interface PersonalReward { outcome?: 'extracted' | 'failed' | 'hell-victory'; baseCleared?: boolean; hellFloor?: number; lost?: number; earned?: number; spent?: number; id: string; coins: number; materials: number }
export interface HazardView { innerRadius?: number; length?: number; width?: number; persistent?: boolean; id: string; owner: string; kind: 'poison' | 'egg' | 'echo' | 'root' | 'blast' | 'ring'; x: number; y: number; age: number; delay: number; duration: number; radius: number; angle: number; gap: number; sourceX: number; sourceY: number }
export interface SpawnWarningView { duration?: number; x: number; y: number; wave: number; kind: string; count: number; seconds: number }
export interface WavePreparation { readyIds: string[]; participantIds: string[]; countdown: number; startedAt: number; reminded: boolean }
export interface WaveBatchView { at: number; kind: string; count: number; angle: number; tier: number; priority: boolean; mode: 'scattered' | 'edge' | 'special'; sector: number }
export interface WavePlanView { id: string; round: number; name: string; hint: string; duration: number; budget: number; spent: number; batches: WaveBatchView[] }
export interface WavePlansView { current?: WavePlanView; next?: WavePlanView }
export const waveReadySchema = z.object({ round: z.number().int().positive(), ready: z.boolean() }).strict();
const preparationSchema = z.object({ readyIds: z.array(z.string()), participantIds: z.array(z.string()), countdown: z.number().nonnegative(), startedAt: z.number(), reminded: z.boolean() });
export interface Snapshot { expedition?: ExpeditionViewData; experienceOrbs?: ExperienceOrbData[]; battleClock?: number; wavePlans?: WavePlansView; paused?: boolean; preparation?: WavePreparation; loot?: LootItemData[]; spawnWarnings?: SpawnWarningView[]; pendingSpawns?: number; hazards?: HazardView[]; resting?: boolean; rewards?: PersonalReward[]; protocol: string; roomId: string; hostId: string; stage: Stage; round: number; seconds: number; width: number; height: number; players: PlayerView[]; enemies: EnemyView[]; projectiles: ProjectileView[]; effects: EffectView[]; results: RoundResult[]; error: string; serverTime: number }
const personalRoundFields = { participating: z.boolean().optional(), coinsEarned: z.number().int().min(0).max(2147483647).optional(), coinsSpent: z.number().int().min(0).max(2147483647).optional(), safe: z.array(lootItemSchema).optional(), assists: z.number().int().nonnegative().optional(), id: z.string().uuid(), kills: z.number().int().min(0).max(2147483647), damage: z.number().finite().nonnegative(), survivalSeconds: z.number().finite().min(0).max(2147483647).optional() };
const personalRoundSchema = z.object(personalRoundFields).strict();
const roundResultFields = { round: z.number().int().min(1).max(2147483647), success: z.boolean(), players: z.array(personalRoundSchema).min(1).max(20) };
export const roundResultSchema = z.object(roundResultFields).strict();
const playerIdSchema = z.string().uuid();
const runFields = { difficulty: expeditionDifficultySchema.default('normal'), id: z.string().uuid(), roomId: z.string().min(1).max(50), contentVersion: z.enum(['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.1.0', '2.2.0', '2.3.0', '3.0.0', '3.1.0', '3.2.0', '3.2.1', '3.2.2', '3.3.0', '3.4.0', '3.5.0', '3.6.0', '3.7.0', '3.8.0', '3.9.0', '3.10.0', '4.0.0', '4.1.0', '4.2.0', '4.3.0', '4.4.0', '5.0.0']), ruleVersion: z.enum(['1', '2']), players: z.array(playerIdSchema).min(1).max(20) };
export const runSchema = z.object(runFields).strict();
const submitFields = { runId: z.string().uuid(), result: roundResultSchema };
export const submitSchema = z.object(submitFields).strict();
const finishFields = { runId: z.string().uuid() };
export const finishSchema = z.object(finishFields).strict();
const profileFields = { characterGrowth: characterGrowthSchema.default(defaultCharacterGrowth), characterGrowthRevision: z.number().int().nonnegative().default(0), characterLevel: z.number().int().min(1).max(20).default(1), loadout: equipmentLoadoutSchema.nullable().optional(), id: z.string().uuid(), name: z.string(), role: z.string().nullable(), coins: z.number(), materials: z.number(), character: characterBuildSchema.nullable().optional() };
export const profileSchema = z.object(profileFields);
const playerViewFields = { id: z.string(), name: z.string(), x: z.number(), y: z.number(), facingX: z.number(), facingY: z.number(), hp: z.number(), maxHp: z.number(), energy: z.number(), capacity: z.number(), meleeWait: z.number(), rangedWait: z.number(), meleeState: z.string(), rangedState: z.string(), dashCooldown: z.number(), blocking: z.boolean(), connected: z.boolean(), ready: z.boolean(), growth: z.array(growthSchema), kills: z.number(), damage: z.number(), blocked: z.number() };
const predictionFields = { heartWait: z.number().default(1), dashLeft: z.number().default(0), dashX: z.number().default(0), dashY: z.number().default(1), meleeCount: z.number().default(0), rangedCount: z.number().default(0), sequence: z.number().default(0) };
const abilityFields = { progress: abilityProgressSchema.optional(), id: z.string(), name: z.string(), kind: z.literal('skill'), skillType: z.enum(['melee', 'ranged']), icon: z.string(), interval: z.number().positive(), remaining: z.number().nonnegative(), cost: z.number().nonnegative(), state: z.string(), triggers: z.number().int().nonnegative() };
const abilitySchema = z.object(abilityFields);
const predictedPlayerFields = { guard: guardSchema.optional(), level: z.number().int().min(1).max(100).optional(), experience: z.number().nonnegative().optional(), characterLevel: z.number().int().min(1).max(20).optional(), banners: bannerStateSchema.optional(), heartProgress: heartProgressSchema.optional(), hasteLeft: z.number().optional(), focusLeft: z.number().optional(), shieldLeft: z.number().optional(), lootShield: z.number().optional(), energyRecoveryBonus: z.number().nonnegative().optional(), resonance: resonanceSchema.optional(), buildItems: z.array(buildItemSchema).optional(), buildRevision: z.number().int().optional(), reviveRemaining: z.number().nonnegative().default(0), assists: z.number().int().nonnegative().default(0), loadout: equipmentLoadoutSchema.optional(), ...playerViewFields, ...predictionFields, abilities: z.array(abilitySchema).optional(), survivalSeconds: z.number().nonnegative().optional(), stats: characterStatsSchema.optional() };
const playerViewSchema = z.object(predictedPlayerFields);
const enemyViewFields = { id: z.string(), kind: z.string(), x: z.number(), y: z.number(), radius: z.number(), hp: z.number(), maxHp: z.number(), state: z.string(), facingX: z.number(), facingY: z.number(), timer: z.number() };
const optionalCoordinate = z.number().finite().optional();
const optionalTimer = z.number().finite().nonnegative().optional();
const enemyActionFields = { abilities: enemyAbilitySchema.optional(), bornWave: optionalTimer, expiresAt: optionalTimer, attackX: optionalCoordinate, attackY: optionalCoordinate, originX: optionalCoordinate, originY: optionalCoordinate, attackCount: optionalTimer, combo: optionalTimer, hitIds: z.array(z.string()).max(20).optional(), linkId: z.string().optional(), linkWait: optionalTimer, parentId: z.string().optional(), summonCount: optionalTimer, escapeLeft: optionalTimer };
const predictedEnemyFields = { thunderResiduals: z.record(z.string(), z.number()).optional(), healthScale: z.number().positive().optional(), damageScale: z.number().positive().optional(), thunderMarks: thunderMarksSchema.optional(), slowUntil: z.number().optional(), slowFactor: z.number().optional(), attackX: z.number().optional(), attackY: z.number().optional(), originX: z.number().optional(), originY: z.number().optional(), attackCount: z.number().optional(), combo: z.number().optional(), hitIds: z.array(z.string()).optional(), ...enemyViewFields, ...enemyActionFields, targetId: z.string().default('') };
const enemyViewSchema = z.object(predictedEnemyFields);
const projectileViewFields = { id: z.string(), x: z.number(), y: z.number(), owner: z.string() };
const movingProjectileFields = { homing: z.number().int().min(1).max(20).optional(), homingTravel: z.number().nonnegative().optional(), windScale: z.number().optional(), overload: z.number().optional(), areaLevel: z.number().optional(), areaScale: z.number().optional(), releaseLevel: z.number().optional(), releaseGroup: z.string().optional(), releaseAngle: z.number().optional(), terminal: z.boolean().optional(),  level: z.number().optional(), fork: z.number().optional(), spread: z.number().optional(), echo: z.number().optional(), delay: z.number().optional(), returning: z.boolean().optional(), returnable: z.boolean().optional(), originX: z.number().optional(), originY: z.number().optional(), travel: z.number().optional(), bounces: z.number().optional(), secondary: z.boolean().optional(),  sourceId: z.string().optional(), resonance: z.number().optional(), empowered: z.boolean().optional(), markDuration: z.number().optional(), effect: z.string().optional(), targetId: z.string().optional(), castId: z.string().optional(), pierces: z.number().optional(), hitIds: z.array(z.string()).optional(), blast: z.number().optional(), slow: z.number().optional(), slowDuration: z.number().optional(), bounce: z.boolean().optional(), hostile: z.boolean().optional(), ...projectileViewFields, vx: z.number().default(0), vy: z.number().default(0), ttl: z.number().default(0.6) };
const projectileViewSchema = z.object(movingProjectileFields);
const effectHitIdSchema = z.string();
const effectHitIdsSchema = z.array(effectHitIdSchema).optional();
const effectViewFields = { amount: z.number().nonnegative().optional(), hitIds: effectHitIdsSchema, banner: bannerFieldSchema.optional(), melee: meleeCastSchema.optional(), generation: z.number().optional(), pulses: z.number().optional(), paidCost: z.number().optional(), resonancePower: z.number().optional(),  charged: z.boolean().optional(), edge: z.boolean().optional(), innerRadius: z.number().optional(), innerWidth: z.number().optional(), shape: z.string().optional(), slow: z.number().optional(), groupId: z.string().optional(), markPower: z.number().optional(), markRemaining: z.number().optional(), spreadCount: z.number().optional(),  targetId: z.string().optional(), targetKind: z.enum(['player', 'enemy']).optional(), damage: z.number().nonnegative().optional(), absorbed: z.number().nonnegative().optional(), killed: z.boolean().optional(), flavor: z.string().optional(), castId: z.string().optional(), level: z.number().optional(), swing: z.number().optional(), angle: z.number().optional(), width: z.number().optional(), delay: z.number().optional(), sourceId: z.string().optional(), ring: z.boolean().optional(),  owner: z.string().optional(), empowered: z.boolean().optional(), duration: z.number().positive().optional(), facingX: optionalCoordinate, facingY: optionalCoordinate, id: z.string(), x: z.number(), y: z.number(), radius: z.number(), kind: z.string(), ttl: z.number() };
const effectViewSchema = z.object(effectViewFields);
const personalRewardSchema = z.object({ outcome: expeditionOutcomeSchema.optional(), baseCleared: z.boolean().optional(), hellFloor: z.number().int().min(0).max(20).optional(), lost: z.number().nonnegative().optional(), earned: z.number().nonnegative().optional(), spent: z.number().nonnegative().optional(), id: z.string(), coins: z.number().nonnegative(), materials: z.number().nonnegative() });
export const finalRewardsSchema = z.object({ rewards: z.array(personalRewardSchema) });
const hazardFields = { innerRadius: optionalTimer, length: optionalTimer, width: optionalTimer, persistent: z.boolean().optional(), id: z.string(), owner: z.string(), kind: z.enum(['poison', 'egg', 'echo', 'root', 'blast', 'ring']), x: z.number().finite(), y: z.number().finite(), age: z.number().nonnegative(), delay: z.number().nonnegative(), duration: z.number().positive(), radius: z.number().positive(), angle: z.number().finite(), gap: z.number().min(0).max(Math.PI * 2), sourceX: z.number().finite(), sourceY: z.number().finite() };
const hazardSchema = z.object(hazardFields);
const hazardArray = z.array(hazardSchema).max(100).default([]);
const spawnWarningFields = { duration: z.number().positive().optional(), x: z.number().finite(), y: z.number().finite(), wave: z.number().int().positive(), kind: z.string(), count: z.number().int().positive(), seconds: z.number().nonnegative() };
const spawnWarningSchema = z.object(spawnWarningFields);
const waveBatchFields = { at: z.number().min(0).max(300), kind: z.string().max(80), count: z.number().int().positive(), angle: z.number().finite(), tier: z.number().int().min(0).max(3), priority: z.boolean(), mode: z.enum(['scattered', 'edge', 'special']), sector: z.number().int().min(0).max(100) };
const waveBatchSchema = z.object(waveBatchFields);
const wavePlanFields = { id: z.string().max(80), round: z.number().int().positive(), name: z.string().max(160), hint: z.string().max(600), duration: z.number().positive().max(300), budget: z.number().nonnegative(), spent: z.number().nonnegative(), batches: z.array(waveBatchSchema).max(100) };
const wavePlanSchema = z.object(wavePlanFields);
const wavePlansSchema = z.object({ current: wavePlanSchema.optional(), next: wavePlanSchema.optional() });
const snapshotFields = { expedition: expeditionViewSchema.optional(), experienceOrbs: z.array(experienceOrbSchema).max(8192).optional(), battleClock: z.number().nonnegative().optional(), wavePlans: wavePlansSchema.optional(), paused: z.boolean().optional(), preparation: preparationSchema.optional(), loot: z.array(lootItemSchema).optional(), spawnWarnings: z.array(spawnWarningSchema).optional(), pendingSpawns: z.number().int().nonnegative().optional(), hazards: hazardArray, resting: z.boolean().optional(), rewards: z.array(personalRewardSchema).optional(), protocol: z.literal(protocolVersion), roomId: z.string(), hostId: z.string(), stage: z.enum(['waiting', 'rest', 'combat', 'round-result', 'settling', 'final-result']), round: z.number(), seconds: z.number(), width: z.number(), height: z.number(), players: z.array(playerViewSchema), enemies: z.array(enemyViewSchema), projectiles: z.array(projectileViewSchema), effects: z.array(effectViewSchema), results: z.array(roundResultSchema), error: z.string(), serverTime: z.number() };
export const snapshotSchema = z.object(snapshotFields);
const compactPlayerSchema = playerViewSchema.partial({ buildItems: true, loadout: true });
const compactPlayers = z.array(compactPlayerSchema);
const compactFields = { players: compactPlayers, results: snapshotFields.results.optional(), rewards: snapshotFields.rewards };
export const compactSnapshotSchema = snapshotSchema.extend(compactFields);



export const shopTabIdSchema = z.enum(['hearts', 'skills', 'supports']);
export type ShopTabId = z.infer<typeof shopTabIdSchema>;
const shopProductFields = { id: equipmentId, name: z.string(), description: z.string(), tab: shopTabIdSchema, level: z.number().int().min(1).max(20), currentLevel: z.number().int().min(0).max(20), coins: z.number().int().nonnegative(), materials: z.number().int().nonnegative(), soldOut: z.boolean(), recommended: z.boolean() };
const shopProductSchema = z.object(shopProductFields).strict();
const shopTabFields = { id: shopTabIdSchema, name: z.string(), refreshCount: z.number().int().nonnegative(), refreshCoins: z.number().int().nonnegative(), nextRefreshCoins: z.number().int().nonnegative(), canRefresh: z.boolean(), acquired: z.boolean() };
const shopTabSchema = z.object(shopTabFields).strict();
const shopOnboardingFields = { completed: z.boolean(), compatible: z.boolean(), totalCoins: z.number().int().nonnegative(), remainingCoins: z.number().int().nonnegative() };
const shopOnboardingSchema = z.object(shopOnboardingFields).strict();
const shopStateFields = { tabs: z.array(shopTabSchema).length(3), products: z.array(shopProductSchema).max(18), coins: z.number().int().nonnegative(), materials: z.number().int().nonnegative(), revision: z.number().int().nonnegative(), characterLevel: z.number().int().min(1).max(20), ownedDefinitionIds: z.array(equipmentId).max(103), onboarding: shopOnboardingSchema };
export const shopStateSchema = z.object(shopStateFields).strict();
export type ShopStateData = z.infer<typeof shopStateSchema>;
const shopRefreshFields = { tabId: shopTabIdSchema, revision: z.number().int().nonnegative(), requestId: z.string().regex(/^[a-f0-9]{32}$/) };
export const shopRefreshSchema = z.object(shopRefreshFields).strict();
export type ShopRefreshData = z.infer<typeof shopRefreshSchema>;
const shopPurchaseFields = { productId: equipmentId, ...shopRefreshFields };
export const shopPurchaseSchema = z.object(shopPurchaseFields).strict();
export type ShopPurchaseData = z.infer<typeof shopPurchaseSchema>;
const roomIdentityFields = { profile: profileSchema, ownedIds: z.array(equipmentId).max(103), items: z.array(buildItemSchema).max(103) };
export const roomIdentitySchema = z.object(roomIdentityFields).strict();

const requestIdSchema = z.string().regex(/^[a-f0-9]{32}$/);
const characterUpgradeFields = { requestId: requestIdSchema, level: z.number().int().min(1).max(19) };
export const characterUpgradeSchema = z.object(characterUpgradeFields).strict();
export type CharacterUpgradeData = z.infer<typeof characterUpgradeSchema>;
const characterGrowthSaveFields = { requestId: requestIdSchema, revision: z.number().int().nonnegative(), points: characterGrowthSchema };
export const characterGrowthSaveSchema = z.object(characterGrowthSaveFields).strict();
export type CharacterGrowthSaveData = z.infer<typeof characterGrowthSaveSchema>;
const buildCopyFields = { requestId: requestIdSchema, revision: z.number().int().nonnegative(), coins: z.number().int().nonnegative() };
export const buildCopySchema = z.object(buildCopyFields).strict();
const refreshGrowthFields = { requestId: requestIdSchema, choiceId: z.number().int().nonnegative(), refreshCount: z.number().int().nonnegative() };
export const refreshGrowthSchema = z.object(refreshGrowthFields).strict();
export type RefreshGrowthData = z.infer<typeof refreshGrowthSchema>;
const runRefreshFields = { runId: z.string().uuid(), accountId: z.string().uuid(), earned: z.number().int().min(0).max(2147483647), source: z.enum(['level', 'wave']), options: z.array(growthOptionSchema).min(1).max(3) };
export const runRefreshSchema = refreshGrowthSchema.extend(runRefreshFields);
const runRefreshReceiptFields = { options: z.array(growthOptionSchema).min(1).max(3), earned: z.number().int().nonnegative(), spent: z.number().int().nonnegative(), refreshCount: z.number().int().nonnegative() };
export const runRefreshReceiptSchema = z.object(runRefreshReceiptFields);
const runStartResultFields = { players: z.array(roomIdentitySchema) };
export const runStartResultSchema = z.object(runStartResultFields);
