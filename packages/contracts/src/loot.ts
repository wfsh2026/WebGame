import { z } from 'zod';
const identifier = z.string().min(1).max(150);
const lootFields = { skillType: z.enum(['melee', 'ranged']).optional(), id: identifier, definitionId: identifier, name: z.string().max(40), category: z.enum(['consumable', 'insured', 'temporary']), kind: z.string().max(30), effect: z.string().max(40), level: z.number().int().min(1).max(20), wave: z.number().int().positive(), x: z.number().finite(), y: z.number().finite() };
export const lootItemSchema = z.object(lootFields).strict();
export type LootItemData = z.infer<typeof lootItemSchema>;
const pickupFields = { item: lootItemSchema, playerId: identifier, recoveredHp: z.number().nonnegative().optional(), recoveredEnergy: z.number().nonnegative().optional(), grantedShield: z.number().nonnegative().optional() };
export const lootPickupSchema = z.object(pickupFields).strict();
export type LootPickupData = z.infer<typeof lootPickupSchema>;
const lootList = z.array(lootItemSchema);
const lootStateFields = { revision: z.number().int(), safe: lootList, consumables: lootList };
export const lootStateSchema = z.object(lootStateFields).strict();
export type LootStateData = z.infer<typeof lootStateSchema>;
const consumeFields = { id: identifier };
export const consumeLootSchema = z.object(consumeFields).strict();

const experienceFields = { id: identifier, playerId: identifier, amount: z.number().int().positive().max(100000), wave: z.number().int().positive(), bornAt: z.number().nonnegative(), flyingAt: z.number().nonnegative().optional(), x: z.number().finite(), y: z.number().finite() };
export const experienceOrbSchema = z.object(experienceFields).strict();
export type ExperienceOrbData = z.infer<typeof experienceOrbSchema>;
