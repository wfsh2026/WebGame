import { z } from 'zod';

const balance = z.number().int().min(0).max(2147483647);
const assetFields = { coins: balance, materials: balance };
export const testAssetsSchema = z.object(assetFields).strict();
export type TestAssetsData = z.infer<typeof testAssetsSchema>;
const adjustmentFields = { coins: balance, materials: balance, expected: testAssetsSchema };
export const testAssetAdjustmentSchema = z.object(adjustmentFields).strict();
export type TestAssetAdjustmentData = z.infer<typeof testAssetAdjustmentSchema>;
const inventoryGrantFields = { requestId: z.string().uuid() };
export const testInventoryGrantSchema = z.object(inventoryGrantFields).strict();
const inventoryReceiptFields = { addedTypes: z.number().int().positive() };
export const testInventoryReceiptSchema = z.object(inventoryReceiptFields).strict();
