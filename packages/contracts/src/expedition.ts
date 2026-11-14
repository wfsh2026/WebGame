import { z } from 'zod';

export const expeditionDifficultySchema = z.enum(['normal', 'hard', 'nightmare']);
export type ExpeditionDifficultyData = z.infer<typeof expeditionDifficultySchema>;
const actionFields = { round: z.number().int().min(20).max(39), action: z.enum(['continue', 'extract']), acceptRisk: z.boolean().default(false) };
export const expeditionActionSchema = z.object(actionFields).strict();
export type ExpeditionActionData = z.infer<typeof expeditionActionSchema>;
const choices = z.array(z.string()); const gifts = z.record(z.string(), z.number().int().min(0).max(5));
const expeditionViewFields = { difficulty: expeditionDifficultySchema, stages: z.literal(20), hellStages: z.literal(20), hellFloor: z.number().int().min(0).max(20), baseCleared: z.boolean(), decision: z.boolean(), saving: z.boolean(), continuedIds: choices, gifts };
export const expeditionViewSchema = z.object(expeditionViewFields).strict();
export type ExpeditionViewData = z.infer<typeof expeditionViewSchema>;
export const expeditionOutcomeSchema = z.enum(['extracted', 'failed', 'hell-victory']);
const settlementFields = { runId: z.string().uuid(), accountIds: z.array(z.string().uuid()).min(1).max(20), round: z.number().int().min(1).max(40), outcome: expeditionOutcomeSchema };
export const expeditionSettlementSchema = z.object(settlementFields).strict();
const entryFields = { runId: z.string().uuid(), accountId: z.string().uuid(), round: z.literal(20) };
export const hellEntrySchema = z.object(entryFields).strict();
export const expeditionAccessSchema = z.object({ unlocked: z.array(expeditionDifficultySchema).min(1).max(3) }).strict();
const difficultyAccessFields = { difficulty: expeditionDifficultySchema, accountIds: z.array(z.string().uuid()).min(1).max(20) };
export const difficultyAccessSchema = z.object(difficultyAccessFields).strict();
