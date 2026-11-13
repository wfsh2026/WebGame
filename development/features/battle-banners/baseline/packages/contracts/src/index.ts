export * from './loot';
import { lootItemSchema } from './loot';
import type { LootItemData } from './loot';
export * from './test-tools';
export * from './inventory';
import { z } from 'zod';

export const protocolVersion = '15';

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
const growthChoiceFields = { earnedLevel: z.number().int().optional(), wave: z.number().int().positive().optional(), keyWave: z.boolean().optional(), id: z.number().int(), source: z.enum(['level', 'wave', 'link']), options: z.array(growthOptionSchema).min(1).max(3) };
const growthChoiceSchema = z.object(growthChoiceFields).strict();
const rankValue = z.number().int().nonnegative();
const rankKey = z.string();
const characterRanksSchema = z.record(rankKey, rankValue);
const buildStateFields = { characterRanks: characterRanksSchema.default({}), revision: z.number().int(), level: z.number().int(), experience: z.number(), required: z.number(), upgradeCredits: z.number().int(), waveCredits: z.number().int(), items: z.array(buildItemSchema).max(120), loadout: equipmentLoadoutSchema, choices: z.array(growthChoiceSchema) };
export const buildStateSchema = z.object(buildStateFields).strict();
export type BuildStateData = z.infer<typeof buildStateSchema>;
const chooseGrowthFields = { targetId: equipmentId.optional(), choiceId: z.number().int().nonnegative(), index: z.number().int().min(0).max(2) };
export const chooseGrowthSchema = z.object(chooseGrowthFields).strict();

const equipmentStateFields = { loadout: equipmentLoadoutSchema, ownedIds: z.array(equipmentId).max(100), items: z.array(buildItemSchema).max(100), revision: z.number().int().nonnegative() };
export const equipmentStateSchema = z.object(equipmentStateFields).strict();
export type EquipmentStateData = z.infer<typeof equipmentStateSchema>;
const equipmentSaveFields = { loadout: equipmentLoadoutSchema, revision: z.number().int().nonnegative() };
export const equipmentSaveSchema = z.object(equipmentSaveFields).strict();

const credentialsFields = { name: z.string().trim().min(2).max(20).regex(/^[\p{L}\p{N}_-]+$/u), password: z.string().min(8).max(72) };
export const credentialsSchema = z.object(credentialsFields).strict();
const characterPoint = z.number().int().min(0).max(24);
const characterPointFields = { power: characterPoint, magic: characterPoint, vitality: characterPoint, spirit: characterPoint, movement: characterPoint, haste: characterPoint, luck: characterPoint };
const characterPointsSchema = z.object(characterPointFields).strict();
const characterBuildFields = { name: z.string().trim().min(1).max(20), description: z.string().trim().max(120), points: characterPointsSchema, talents: z.array(z.string().min(1).max(30)).max(10) };
export const characterBuildSchema = z.object(characterBuildFields).strict();
export type CharacterBuildData = z.infer<typeof characterBuildSchema>;
const characterCreationFields = { role: z.literal('forest-survival:character/ranger'), character: characterBuildSchema.optional() };
export const characterCreationSchema = z.object(characterCreationFields).strict();
const characterStatsFields = { maxHp: z.number().positive(), maxMp: z.number().positive(), physicalAttack: z.number().positive(), magicalAttack: z.number().positive(), physicalDefense: z.number().nonnegative(), magicalDefense: z.number().nonnegative(), movementSpeed: z.number().positive(), attackSpeed: z.number().positive(), castingSpeed: z.number().positive(), luck: z.number().min(0).max(100) };
export const characterStatsSchema = z.object(characterStatsFields).strict();
export type CharacterStatsData = z.infer<typeof characterStatsSchema>;
const motionFields = { x: z.number().min(0).max(10000), y: z.number().min(0).max(10000), facingX: z.number().min(-1).max(1), facingY: z.number().min(-1).max(1) };
const motionSchema = z.object(motionFields).strict();
const inputFields = { sequence: z.number().int().nonnegative().max(2147483647), x: z.number().min(-1).max(1), y: z.number().min(-1).max(1), block: z.boolean(), dash: z.boolean(), position: motionSchema.optional() };
export const inputSchema = z.object(inputFields).strict();
export const growthSchema = z.enum(['power', 'energy', 'vitality']);
const joinFields = { token: z.string().min(20).max(200), protocol: z.literal(protocolVersion) };
export const joinSchema = z.object(joinFields).strict();
export type Input = z.infer<typeof inputSchema>;
export type Growth = z.infer<typeof growthSchema>;
export type Stage = 'waiting' | 'rest' | 'combat' | 'round-result' | 'settling' | 'final-result';
export interface Profile { loadout?: EquipmentLoadoutData | null; id: string; name: string; role: string | null; coins: number; materials: number; character?: CharacterBuildData | null }
const abilityProgressSchema = z.object({ origin: z.number(), spent: z.boolean(), idle: z.number(), started: z.boolean(), starved: z.number(), released: z.boolean(), stacks: z.number(), quiet: z.number(), charges: z.number(), overload: z.number(), overloadCast: z.number(), landed: z.number(), retain: z.number(), staff: z.number() });
export type AbilityProgressView = z.infer<typeof abilityProgressSchema>;
const heartProgressSchema = z.object({ cooldown: z.number(), low: z.number(), burst: z.number(), idle: z.number() });
export type HeartProgressView = z.infer<typeof heartProgressSchema>;
export interface AbilityView { progress?: AbilityProgressView; id: string; name: string; kind: 'weapon' | 'skill'; icon: string; interval: number; remaining: number; cost: number; state: string; triggers: number }
const resonanceFields = { supportLevel: z.number().optional(), relayCount: z.number().optional(), relayLeft: z.number().optional(), finisher: z.boolean().optional(), cycleCount: z.number().optional(), recoveryCharges: z.number().optional(), lastKind: z.string(), lastAge: z.number(), energyBoost: z.number(), cooldown: z.number(), buffKind: z.string(), buffPower: z.number(), buffLeft: z.number(), buffSource: z.string() };
const resonanceSchema = z.object(resonanceFields);
export type ResonanceView = z.infer<typeof resonanceSchema>;
const thunderMarkSchema = z.object({ residual: z.boolean().optional(), charged: z.boolean().optional(), transfer: z.boolean().optional(), remaining: z.number().nonnegative(), power: z.number().nonnegative() });
const thunderMarksSchema = z.record(z.string(), thunderMarkSchema);
export type ThunderMarksView = z.infer<typeof thunderMarksSchema>;
export interface PlayerView { heartProgress?: HeartProgressView; hasteLeft?: number; focusLeft?: number; shieldLeft?: number; lootShield?: number; manaRecovery?: number; resonance?: ResonanceView; buildItems?: BuildItemData[]; buildRevision?: number; reviveRemaining: number; assists: number; loadout?: EquipmentLoadoutData; abilities?: AbilityView[]; survivalSeconds?: number; stats?: CharacterStatsData; id: string; name: string; x: number; y: number; facingX: number; facingY: number; hp: number; maxHp: number; mp: number; maxMp: number; energy: number; capacity: number; weaponWait: number; skillWait: number; weaponState: string; skillState: string; dashCooldown: number; blocking: boolean; connected: boolean; ready: boolean; growth: Growth[]; kills: number; damage: number; blocked: number; heartWait: number; dashLeft: number; dashX: number; dashY: number; weaponCount: number; skillCount: number; sequence: number }
export interface EnemyView { thunderResiduals?: Record<string, number>; healthScale?: number; damageScale?: number; thunderMarks?: ThunderMarksView; slowUntil?: number; slowFactor?: number; id: string; kind: string; x: number; y: number; radius: number; hp: number; maxHp: number; state: string; facingX: number; facingY: number; timer: number; targetId: string; attackX?: number; attackY?: number; originX?: number; originY?: number; attackCount?: number; combo?: number; hitIds?: string[]; linkId?: string; linkWait?: number; parentId?: string; summonCount?: number; escapeLeft?: number }
export interface ProjectileView { overload?: number; areaLevel?: number; areaScale?: number; releaseLevel?: number; releaseGroup?: string; terminal?: boolean;  level?: number; fork?: number; spread?: number; echo?: number; delay?: number; returning?: boolean; returnable?: boolean; originX?: number; originY?: number; travel?: number; bounces?: number; secondary?: boolean;  sourceId?: string; resonance?: number; empowered?: boolean; markDuration?: number; effect?: string; targetId?: string; castId?: string; pierces?: number; hitIds?: string[]; blast?: number; slow?: number; slowDuration?: number; bounce?: boolean; id: string; x: number; y: number; owner: string; vx: number; vy: number; ttl: number; hostile?: boolean }
export interface EffectView { generation?: number; pulses?: number; paidCost?: number; resonancePower?: number;  charged?: boolean; edge?: boolean; innerRadius?: number; innerWidth?: number; shape?: string; slow?: number; groupId?: string; markPower?: number; markRemaining?: number; spreadCount?: number;  targetId?: string; targetKind?: 'player' | 'enemy'; damage?: number; absorbed?: number; killed?: boolean; flavor?: string; castId?: string; level?: number; swing?: number; angle?: number; width?: number; delay?: number; sourceId?: string; ring?: boolean;  owner?: string; empowered?: boolean; id: string; x: number; y: number; radius: number; kind: string; ttl: number; duration?: number; facingX?: number; facingY?: number }
export interface RoundResult { round: number; success: boolean; players: { id: string; kills: number; damage: number; survivalSeconds?: number; assists?: number; safe?: LootItemData[] }[] }
export interface PersonalReward { id: string; coins: number; materials: number }
export interface HazardView { id: string; owner: string; kind: 'poison' | 'egg' | 'echo'; x: number; y: number; age: number; delay: number; duration: number; radius: number; angle: number; gap: number; sourceX: number; sourceY: number }
export interface SpawnWarningView { duration?: number; x: number; y: number; wave: number; kind: string; count: number; seconds: number }
export interface WavePreparation { readyIds: string[]; participantIds: string[]; countdown: number; startedAt: number; reminded: boolean }
export const waveReadySchema = z.object({ round: z.number().int().positive(), ready: z.boolean() }).strict();
const preparationSchema = z.object({ readyIds: z.array(z.string()), participantIds: z.array(z.string()), countdown: z.number().nonnegative(), startedAt: z.number(), reminded: z.boolean() });
export interface Snapshot { preparation?: WavePreparation; loot?: LootItemData[]; spawnWarnings?: SpawnWarningView[]; pendingSpawns?: number; hazards?: HazardView[]; resting?: boolean; rewards?: PersonalReward[]; protocol: string; roomId: string; hostId: string; stage: Stage; round: number; seconds: number; width: number; height: number; players: PlayerView[]; enemies: EnemyView[]; projectiles: ProjectileView[]; effects: EffectView[]; results: RoundResult[]; error: string; serverTime: number }
const personalRoundFields = { safe: z.array(lootItemSchema).optional(), assists: z.number().int().nonnegative().optional(), id: z.string().uuid(), kills: z.number().int().min(0).max(2147483647), damage: z.number().finite().nonnegative(), survivalSeconds: z.number().finite().min(0).max(2147483647).optional() };
const personalRoundSchema = z.object(personalRoundFields).strict();
const roundResultFields = { round: z.number().int().min(1).max(2147483647), success: z.boolean(), players: z.array(personalRoundSchema).min(1).max(20) };
export const roundResultSchema = z.object(roundResultFields).strict();
const playerIdSchema = z.string().uuid();
const runFields = { id: z.string().uuid(), roomId: z.string().min(1).max(50), contentVersion: z.enum(['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.1.0', '2.2.0', '2.3.0', '3.0.0', '3.1.0', '3.2.0', '3.2.1', '3.2.2', '3.3.0', '3.4.0', '3.5.0', '3.6.0', '3.7.0']), ruleVersion: z.literal('1'), players: z.array(playerIdSchema).min(1).max(20) };
export const runSchema = z.object(runFields).strict();
const submitFields = { runId: z.string().uuid(), result: roundResultSchema };
export const submitSchema = z.object(submitFields).strict();
const finishFields = { runId: z.string().uuid() };
export const finishSchema = z.object(finishFields).strict();
const profileFields = { loadout: equipmentLoadoutSchema.nullable().optional(), id: z.string().uuid(), name: z.string(), role: z.string().nullable(), coins: z.number(), materials: z.number(), character: characterBuildSchema.nullable().optional() };
export const profileSchema = z.object(profileFields);
const playerViewFields = { id: z.string(), name: z.string(), x: z.number(), y: z.number(), facingX: z.number(), facingY: z.number(), hp: z.number(), maxHp: z.number(), mp: z.number(), maxMp: z.number(), energy: z.number(), capacity: z.number(), weaponWait: z.number(), skillWait: z.number(), weaponState: z.string(), skillState: z.string(), dashCooldown: z.number(), blocking: z.boolean(), connected: z.boolean(), ready: z.boolean(), growth: z.array(growthSchema), kills: z.number(), damage: z.number(), blocked: z.number() };
const predictionFields = { heartWait: z.number().default(1), dashLeft: z.number().default(0), dashX: z.number().default(0), dashY: z.number().default(1), weaponCount: z.number().default(0), skillCount: z.number().default(0), sequence: z.number().default(0) };
const abilityFields = { progress: abilityProgressSchema.optional(), id: z.string(), name: z.string(), kind: z.enum(['weapon', 'skill']), icon: z.string(), interval: z.number().positive(), remaining: z.number().nonnegative(), cost: z.number().nonnegative(), state: z.string(), triggers: z.number().int().nonnegative() };
const abilitySchema = z.object(abilityFields);
const predictedPlayerFields = { heartProgress: heartProgressSchema.optional(), hasteLeft: z.number().optional(), focusLeft: z.number().optional(), shieldLeft: z.number().optional(), lootShield: z.number().optional(), manaRecovery: z.number().nonnegative().optional(), resonance: resonanceSchema.optional(), buildItems: z.array(buildItemSchema).optional(), buildRevision: z.number().int().optional(), reviveRemaining: z.number().nonnegative().default(0), assists: z.number().int().nonnegative().default(0), loadout: equipmentLoadoutSchema.optional(), ...playerViewFields, ...predictionFields, abilities: z.array(abilitySchema).optional(), survivalSeconds: z.number().nonnegative().optional(), stats: characterStatsSchema.optional() };
const playerViewSchema = z.object(predictedPlayerFields);
const enemyViewFields = { id: z.string(), kind: z.string(), x: z.number(), y: z.number(), radius: z.number(), hp: z.number(), maxHp: z.number(), state: z.string(), facingX: z.number(), facingY: z.number(), timer: z.number() };
const optionalCoordinate = z.number().finite().optional();
const optionalTimer = z.number().finite().nonnegative().optional();
const enemyActionFields = { attackX: optionalCoordinate, attackY: optionalCoordinate, originX: optionalCoordinate, originY: optionalCoordinate, attackCount: optionalTimer, combo: optionalTimer, hitIds: z.array(z.string()).max(20).optional(), linkId: z.string().optional(), linkWait: optionalTimer, parentId: z.string().optional(), summonCount: optionalTimer, escapeLeft: optionalTimer };
const predictedEnemyFields = { thunderResiduals: z.record(z.string(), z.number()).optional(), healthScale: z.number().positive().optional(), damageScale: z.number().positive().optional(), thunderMarks: thunderMarksSchema.optional(), slowUntil: z.number().optional(), slowFactor: z.number().optional(), attackX: z.number().optional(), attackY: z.number().optional(), originX: z.number().optional(), originY: z.number().optional(), attackCount: z.number().optional(), combo: z.number().optional(), hitIds: z.array(z.string()).optional(), ...enemyViewFields, ...enemyActionFields, targetId: z.string().default('') };
const enemyViewSchema = z.object(predictedEnemyFields);
const projectileViewFields = { id: z.string(), x: z.number(), y: z.number(), owner: z.string() };
const movingProjectileFields = { overload: z.number().optional(), areaLevel: z.number().optional(), areaScale: z.number().optional(), releaseLevel: z.number().optional(), releaseGroup: z.string().optional(), terminal: z.boolean().optional(),  level: z.number().optional(), fork: z.number().optional(), spread: z.number().optional(), echo: z.number().optional(), delay: z.number().optional(), returning: z.boolean().optional(), returnable: z.boolean().optional(), originX: z.number().optional(), originY: z.number().optional(), travel: z.number().optional(), bounces: z.number().optional(), secondary: z.boolean().optional(),  sourceId: z.string().optional(), resonance: z.number().optional(), empowered: z.boolean().optional(), markDuration: z.number().optional(), effect: z.string().optional(), targetId: z.string().optional(), castId: z.string().optional(), pierces: z.number().optional(), hitIds: z.array(z.string()).optional(), blast: z.number().optional(), slow: z.number().optional(), slowDuration: z.number().optional(), bounce: z.boolean().optional(), hostile: z.boolean().optional(), ...projectileViewFields, vx: z.number().default(0), vy: z.number().default(0), ttl: z.number().default(0.6) };
const projectileViewSchema = z.object(movingProjectileFields);
const effectViewFields = { generation: z.number().optional(), pulses: z.number().optional(), paidCost: z.number().optional(), resonancePower: z.number().optional(),  charged: z.boolean().optional(), edge: z.boolean().optional(), innerRadius: z.number().optional(), innerWidth: z.number().optional(), shape: z.string().optional(), slow: z.number().optional(), groupId: z.string().optional(), markPower: z.number().optional(), markRemaining: z.number().optional(), spreadCount: z.number().optional(),  targetId: z.string().optional(), targetKind: z.enum(['player', 'enemy']).optional(), damage: z.number().nonnegative().optional(), absorbed: z.number().nonnegative().optional(), killed: z.boolean().optional(), flavor: z.string().optional(), castId: z.string().optional(), level: z.number().optional(), swing: z.number().optional(), angle: z.number().optional(), width: z.number().optional(), delay: z.number().optional(), sourceId: z.string().optional(), ring: z.boolean().optional(),  owner: z.string().optional(), empowered: z.boolean().optional(), duration: z.number().positive().optional(), facingX: optionalCoordinate, facingY: optionalCoordinate, id: z.string(), x: z.number(), y: z.number(), radius: z.number(), kind: z.string(), ttl: z.number() };
const effectViewSchema = z.object(effectViewFields);
const personalRewardSchema = z.object({ id: z.string(), coins: z.number().nonnegative(), materials: z.number().nonnegative() });
export const finalRewardsSchema = z.object({ rewards: z.array(personalRewardSchema) });
const hazardFields = { id: z.string(), owner: z.string(), kind: z.enum(['poison', 'egg', 'echo']), x: z.number().finite(), y: z.number().finite(), age: z.number().nonnegative(), delay: z.number().nonnegative(), duration: z.number().positive(), radius: z.number().positive(), angle: z.number().finite(), gap: z.number().min(0).max(Math.PI * 2), sourceX: z.number().finite(), sourceY: z.number().finite() };
const hazardSchema = z.object(hazardFields);
const hazardArray = z.array(hazardSchema).max(100).default([]);
const spawnWarningFields = { duration: z.number().positive().optional(), x: z.number().finite(), y: z.number().finite(), wave: z.number().int().positive(), kind: z.string(), count: z.number().int().positive(), seconds: z.number().nonnegative() };
const spawnWarningSchema = z.object(spawnWarningFields);
const snapshotFields = { preparation: preparationSchema.optional(), loot: z.array(lootItemSchema).optional(), spawnWarnings: z.array(spawnWarningSchema).optional(), pendingSpawns: z.number().int().nonnegative().optional(), hazards: hazardArray, resting: z.boolean().optional(), rewards: z.array(personalRewardSchema).optional(), protocol: z.literal(protocolVersion), roomId: z.string(), hostId: z.string(), stage: z.enum(['waiting', 'rest', 'combat', 'round-result', 'settling', 'final-result']), round: z.number(), seconds: z.number(), width: z.number(), height: z.number(), players: z.array(playerViewSchema), enemies: z.array(enemyViewSchema), projectiles: z.array(projectileViewSchema), effects: z.array(effectViewSchema), results: z.array(roundResultSchema), error: z.string(), serverTime: z.number() };
export const snapshotSchema = z.object(snapshotFields);
const compactPlayerSchema = playerViewSchema.partial({ buildItems: true, loadout: true });
const compactPlayers = z.array(compactPlayerSchema);
const compactFields = { players: compactPlayers, results: snapshotFields.results.optional(), rewards: snapshotFields.rewards };
export const compactSnapshotSchema = snapshotSchema.extend(compactFields);



const shopProductFields = { id: equipmentId, name: z.string(), description: z.string(), tab: z.string(), level: z.number().int().min(1).max(20), currentLevel: z.number().int().min(0).max(20), coins: z.number().int().nonnegative(), materials: z.number().int().nonnegative(), soldOut: z.boolean() };
const shopProductSchema = z.object(shopProductFields).strict();
const shopTabFields = { id: z.string(), name: z.string() };
const shopTabSchema = z.object(shopTabFields).strict();
const shopStateFields = { tabs: z.array(shopTabSchema), products: z.array(shopProductSchema).max(6), coins: z.number().int().nonnegative(), materials: z.number().int().nonnegative(), revision: z.number().int().nonnegative(), refreshCoins: z.number().int().nonnegative(), canRefresh: z.boolean() };
export const shopStateSchema = z.object(shopStateFields).strict();
export type ShopStateData = z.infer<typeof shopStateSchema>;
const shopRefreshFields = { revision: z.number().int().nonnegative(), requestId: z.string().regex(/^[a-f0-9]{32}$/) };
export const shopRefreshSchema = z.object(shopRefreshFields).strict();
export type ShopRefreshData = z.infer<typeof shopRefreshSchema>;
const shopPurchaseFields = { productId: equipmentId, ...shopRefreshFields };
export const shopPurchaseSchema = z.object(shopPurchaseFields).strict();
export type ShopPurchaseData = z.infer<typeof shopPurchaseSchema>;
const roomIdentityFields = { profile: profileSchema, ownedIds: z.array(equipmentId).max(100), items: z.array(buildItemSchema).max(100) };
export const roomIdentitySchema = z.object(roomIdentityFields).strict();
