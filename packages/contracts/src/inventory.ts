import { z } from 'zod';

export const inventoryCategorySchema = z.enum(['skill', 'equipment', 'material']);
const itemFields = { level: z.number().int().min(1).max(20).default(1), definitionId: z.string().default(''), id: z.string().min(1), name: z.string().min(1).max(24), category: inventoryCategorySchema, quantity: z.number().int().positive(), effect: z.string().max(96), acquiredAt: z.string().datetime() };
export const inventoryItemSchema = z.object(itemFields).strict();
export const inventoryStateSchema = z.array(inventoryItemSchema);
export type InventoryItemData = z.infer<typeof inventoryItemSchema>;
export type InventoryCategory = z.infer<typeof inventoryCategorySchema>;
