import { z } from 'zod';

const positive = z.number().positive();
const enemyKind = z.string().regex(/^(normal|swift|elite|(tree|wolf|hammer|shield|archer|bomb|sower|protector|brood|moth|squirrel)-(normal|elite|boss))$/);
const enemyFields = { id: z.string().regex(/^forest-survival:enemy\/[a-z-]+$/), kind: enemyKind, name: z.string().min(1).max(30).optional(), behavior: z.enum(['tree', 'wolf', 'hammer', 'shield', 'archer', 'bomb', 'sower', 'protector', 'brood', 'moth', 'squirrel']).optional(), rank: z.enum(['normal', 'elite', 'boss']).optional(), hp: positive, speed: positive, radius: positive, damage: positive, windup: positive, recovery: positive, reach: positive };
const enemySchema = z.object(enemyFields).strict().superRefine((enemy, context) => {
  if (!enemy.kind.includes('-')) return;
  const expected = `${enemy.behavior}-${enemy.rank}`;
  if (enemy.kind !== expected) context.addIssue({ code: 'custom', message: '怪物类型与行为、等级不匹配' });
});
const mapObjectFields = { id: z.number().int(), name: z.string(), type: z.enum(['spawn', 'enemy-spawn', 'obstacle']), x: z.number(), y: z.number(), width: z.number().nonnegative(), height: z.number().nonnegative(), rotation: z.literal(0), visible: z.boolean() };
const objectSchema = z.object(mapObjectFields).strict();
const mapLayerFields = { id: z.number().int(), name: z.string(), type: z.literal('objectgroup'), opacity: z.literal(1), visible: z.boolean(), x: z.literal(0), y: z.literal(0), draworder: z.literal('topdown'), objects: z.array(objectSchema) };
const layerSchema = z.object(mapLayerFields).strict();
const unsupportedTilesetSchema = z.never();
const mapFields = { type: z.literal('map'), version: z.literal('1.10'), tiledversion: z.literal('1.11.2'), orientation: z.literal('orthogonal'), renderorder: z.literal('right-down'), width: z.number().int().positive(), height: z.number().int().positive(), tilewidth: z.literal(32), tileheight: z.literal(32), infinite: z.literal(false), nextlayerid: z.number(), nextobjectid: z.number(), layers: z.array(layerSchema), tilesets: z.array(unsupportedTilesetSchema) };
export const mapSchema = z.object(mapFields).strict();
const assetPathSchema = z.string().regex(/^assets\/[a-z0-9-]+\.(svg|webp|png)$/);
const unsupportedDependencySchema = z.never();
const playerLimitsFields = { min: z.literal(1), max: z.number().int().min(1).max(20) };
const attributePointsFields = { power: z.number().int().nonnegative(), magic: z.number().int().nonnegative(), vitality: z.number().int().nonnegative(), spirit: z.number().int().nonnegative(), movement: z.number().int().nonnegative(), haste: z.number().int().nonnegative(), luck: z.number().int().nonnegative() };
const characterFields = { id: z.literal('forest-survival:character/ranger'), points: z.object(attributePointsFields).strict() };
const heartFields = { capacity: positive, interval: positive, recovery: positive, manaCost: positive, slots: z.literal(2) };
const weaponFields = { interval: positive, cost: positive, coefficient: positive, speed: positive, range: positive, supportSlots: z.literal(1) };
const skillFields = { interval: positive, cost: positive, coefficient: positive, range: positive, supportSlots: z.literal(1) };
const supportFields = { host: z.literal('weapon'), costMultiplier: positive, damageMultiplier: positive };
const supportIdSchema = z.string().regex(/^forest-survival:support\/[a-z-]+$/);
const supportDefinitionFields = { id: supportIdSchema, name: z.string().min(1), host: z.enum(['weapon', 'skill']), costMultiplier: positive, damageMultiplier: positive };
export const supportDefinitionSchema = z.object(supportDefinitionFields).strict();
const supportFileFields = { id: supportIdSchema, path: z.string().regex(/^supports\/[a-z-]+\.json$/) };
const supportFileSchema = z.object(supportFileFields).strict();
const waveBehavior = z.enum(['tree', 'wolf', 'hammer', 'shield', 'archer', 'bomb', 'sower', 'protector', 'brood', 'moth']);
const mixFields = { behavior: waveBehavior, weight: z.number().positive().max(100) };
const mixEntrySchema = z.object(mixFields).strict();
const mixSchema = z.array(mixEntrySchema).min(1).max(10).superRefine((items, context) => {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  const behaviors = items.map(item => item.behavior); const unique = new Set(behaviors);
  if (total !== 100 || unique.size !== items.length) context.addIssue({ code: 'custom', message: '刷怪配比合计必须为 100，且种类不可重复' });
});
const spawnBehavior = z.enum(['tree', 'wolf', 'hammer', 'shield', 'archer', 'bomb', 'sower', 'protector', 'brood', 'moth']);
const spawnBehaviors = z.array(spawnBehavior).min(1).max(10);
const spawnGroupFields = { start: z.number().min(0).max(300), end: z.number().min(0).max(300), interval: z.number().min(.5).max(300), minimumInterval: z.number().min(.5).max(300).optional(), acceleration: z.number().min(0).max(10).optional(), min: z.number().int().min(1).max(30), max: z.number().int().min(1).max(30), behaviors: spawnBehaviors, mode: z.enum(['scattered', 'edge', 'special']), rank: z.enum(['normal', 'elite', 'boss']).optional(), priority: z.boolean().optional(), repeats: z.number().int().min(1).max(600).optional() };
const spawnGroupSchema = z.object(spawnGroupFields).strict().superRefine((group, context) => {
  if (group.end < group.start || group.min > group.max || (group.minimumInterval ?? group.interval) > group.interval) context.addIssue({ code: 'custom', message: '刷怪组的时间、数量或间隔范围不合法' });
});
const spawnGroups = z.array(spawnGroupSchema).min(1).max(12);
const waveFields = { groups: spawnGroups.optional(), name: z.string().min(1).max(20).optional(), hint: z.string().max(80).optional(), mix: mixSchema.optional(), stageMixes: z.array(mixSchema).length(4).optional(), eliteChance: z.number().min(0).max(.35).optional(), bossChance: z.number().min(0).max(.05).optional(), guarantee: z.enum(['none', 'elite', 'boss']).optional(), healthMultiplier: positive.optional(), damageMultiplier: positive.optional(), squirrels: z.boolean().optional(), interval: z.number().min(15).max(300), count: z.number().int().min(1).max(100), kinds: z.array(enemyKind).min(1).max(20) };
const waveSchema = z.object(waveFields).strict();
const equipmentFileFields = { id: z.string().regex(/^forest-survival:(heart|weapon|skill|support)\/[a-z-]+$/), path: z.string().regex(/^(hearts|weapons|skills|supports)\/[a-z-]+\.json$/) };
const equipmentFileSchema = z.object(equipmentFileFields).strict();
const nonnegative = z.number().nonnegative();
const equipmentDefinitionFields = { description: z.string().max(200).optional(), effect: z.enum(['slash', 'dual', 'spear', 'hammer', 'blade', 'star', 'fireball', 'frost', 'economy', 'overload', 'haste', 'area', 'multiple', 'knockback', 'cycle', 'thunder-staff', 'thunder-seal', 'resonance', 'fork', 'unleash', 'aftershock', 'execution-spread', 'star-beam', 'chain-lightning', 'decay-curse', 'sword-array', 'binding-trap']).optional(), capacityGrowth: nonnegative.optional(), recoveryGrowth: nonnegative.optional(), angle: nonnegative.optional(), width: nonnegative.optional(), knockback: nonnegative.optional(), id: equipmentFileFields.id, name: z.string().min(1), kind: z.enum(['heart', 'weapon', 'skill', 'support']), slots: z.number().int().min(0).max(12).default(0), capacity: nonnegative.default(0), recovery: nonnegative.default(0), manaCost: nonnegative.default(0), interval: nonnegative.default(0), cost: nonnegative.default(0), supportSlots: z.number().int().min(0).max(12).default(0), costMultiplier: positive.default(1), damageMultiplier: positive.default(1), host: z.enum(['weapon', 'skill', 'both', '']).default(''), damage: nonnegative.default(0), coefficient: nonnegative.default(0), speed: nonnegative.default(0), range: nonnegative.default(0), projectiles: z.number().int().min(1).max(5).default(1), requiresProjectile: z.boolean().default(false), delivery: z.enum(['projectile', 'nova', 'melee']).default('projectile') };
const equipmentDefinitionSchema = z.object(equipmentDefinitionFields).strict().superRefine((item, context) => {
  const matches = item.id.startsWith(`forest-survival:${item.kind}/`);
  const validHeart = item.kind !== 'heart' || (item.capacity > 0 && item.recovery > 0 && item.interval > 0 && item.slots > 0);
  const validAbility = (item.kind !== 'weapon' && item.kind !== 'skill') || (item.interval > 0 && item.range > 0 && (item.delivery !== 'projectile' || item.speed > 0));
  const validSupport = item.kind !== 'support' || item.host !== '';
  if (!matches || !validHeart || !validAbility || !validSupport) context.addIssue({ code: 'custom', message: '装备类型、资源或效果配置不合法' });
});
const contentFields = { cycleWaves: z.boolean().optional(), equipmentFiles: z.array(equipmentFileSchema).max(100).optional(), waves: z.array(waveSchema).min(1).max(100).optional(), revivalSeconds: z.number().min(1).max(120).optional(), supportFiles: z.array(supportFileSchema).max(50).optional(), id: z.literal('forest-survival'), name: z.string(), version: z.enum(['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.1.0', '2.2.0', '2.3.0', '3.0.0', '3.1.0', '3.2.0', '3.2.1', '3.2.2', '3.3.0', '3.4.0', '3.5.0', '3.6.0', '3.7.0']), schemaVersion: z.literal('1'), coreVersion: z.literal('1'), entryMap: z.literal('maps/hall.json'), combatMap: z.literal('maps/arena.json'), assets: z.array(assetPathSchema), dependencies: z.array(unsupportedDependencySchema), players: z.object(playerLimitsFields).strict(), rounds: z.number().int().min(0).max(2), roundDuration: z.number().min(30).max(300), restDuration: z.number().min(5).max(60), maxAlive: z.number().int().min(1).max(2048), maxSpawned: z.number().int().min(1).max(1200), ruleTemplate: z.literal('cooperative-survival-v1'), rewardTemplate: z.literal('forest-v1'), character: z.object(characterFields).strict(), heart: z.object(heartFields).strict(), weapon: z.object(weaponFields).strict(), skill: z.object(skillFields).strict(), support: z.object(supportFields).strict(), enemies: z.array(enemySchema).min(3).max(40) };
export const contentSchema = z.object(contentFields).strict().superRefine((value, context) => {
  const points = Object.values(value.character.points); const sum = points.reduce((total, item) => total + item, 0);
  if (sum !== 20) context.addIssue({ code: 'custom', message: '初始属性总和必须为 20' });
  const kinds = value.enemies.map(enemy => enemy.kind); const known = new Set(kinds);
  if (known.size !== kinds.length) context.addIssue({ code: 'custom', message: '怪物类型不能重复' });
  if (value.cycleWaves && value.waves?.length !== 10) context.addIssue({ code: 'custom', message: '循环阶段必须配置十个波次' });
  for (const [index, wave] of (value.waves ?? []).entries()) {
    for (const group of wave.groups ?? []) {
      if (group.end > wave.interval) context.addIssue({ code: 'custom', message: '刷怪组不能超出本波刷怪时长' });
      for (const behavior of group.behaviors) {
        const kind = `${behavior}-${group.rank ?? 'normal'}`;
        if (!known.has(kind)) context.addIssue({ code: 'custom', message: `刷怪组引用了未配置的怪物: ${kind}` });
      }
    }
    for (const kind of wave.kinds) if (!known.has(kind)) context.addIssue({ code: 'custom', message: '波次引用了未配置的怪物' });
    if (!value.cycleWaves) continue;
    const expected = index === 4 ? 'elite' : index === 9 ? 'boss' : 'none';
    if (!wave.mix || wave.guarantee !== expected) context.addIssue({ code: 'custom', message: '十波循环需要种类配比及第 5/10 波保底' });
    const mixes = [wave.mix ?? [], ...(wave.stageMixes ?? [])];
    for (const mix of mixes) for (const item of mix) for (const rank of ['normal', 'elite', 'boss']) {
      const kind = `${item.behavior}-${rank}`;
      if (!known.has(kind)) context.addIssue({ code: 'custom', message: `缺少怪物品质配置: ${kind}` });
    }
    if (wave.squirrels && !known.has('squirrel-normal')) context.addIssue({ code: 'custom', message: '缺少携宝松鼠配置' });
  }
});
export type ForestContent = z.infer<typeof contentSchema>;
export type GameMap = z.infer<typeof mapSchema>;

export function resolveContentSupports(content: ForestContent, sources: Record<string, unknown>) {
  const ids = new Set<string>(['forest-survival:heart/wind', 'forest-survival:weapon/wind-arrow', 'forest-survival:skill/wind-nova', 'forest-survival:support/energy-saving']);
  const supportDefinitions = (content.supportFiles ?? []).map(reference => {
    const source = sources[reference.path];
    const definition = supportDefinitionSchema.parse(source);
    if (definition.id !== reference.id || ids.has(definition.id)) throw new Error('辅助 ID 引用不匹配或重复');
    ids.add(definition.id);
    return definition;
  });
  const equipmentDefinitions = (content.equipmentFiles ?? []).map(reference => {
    const definition = equipmentDefinitionSchema.parse(sources[reference.path]);
    const folder = { heart: 'hearts', weapon: 'weapons', skill: 'skills', support: 'supports' }[definition.kind];
    if (definition.id !== reference.id || ids.has(definition.id) || !reference.path.startsWith(`${folder}/`)) throw new Error('装备 ID 引用不匹配或重复');
    ids.add(definition.id);
    return definition;
  });
  return { ...content, supportDefinitions, equipmentDefinitions };
}
