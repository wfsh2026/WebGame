import { z } from 'zod';

export const tutorialMilestoneSchema = z.enum(['shop', 'build', 'entered', 'reward', 'battle-build', 'settled', 'growth-viewed', 'upgraded', 'allocated']);
export type TutorialMilestone = z.infer<typeof tutorialMilestoneSchema>;
const milestoneList = z.array(tutorialMilestoneSchema).max(9);
const progressFields = { version: z.literal(1), enabled: z.boolean(), collapsed: z.boolean(), revision: z.number().int().nonnegative(), milestones: milestoneList };
export const tutorialProgressSchema = z.object(progressFields).strict();
export type TutorialProgressData = z.infer<typeof tutorialProgressSchema>;
export const initialTutorialProgress: TutorialProgressData = { version: 1, enabled: true, collapsed: false, revision: 0, milestones: [] };

const purchaseFields = { hearts: z.boolean(), skills: z.boolean(), supports: z.boolean(), compatible: z.boolean() };
const purchasesSchema = z.object(purchaseFields).strict();
const stateFields = { ...progressFields, purchases: purchasesSchema };
export const tutorialStateSchema = z.object(stateFields).strict();
export type TutorialStateData = z.infer<typeof tutorialStateSchema>;

const actionSchema = z.enum(['shop-reviewed', 'build-reviewed', 'combat-entered', 'reward-picked', 'battle-build-viewed', 'growth-viewed', 'enable', 'disable', 'collapse', 'expand']);
const updateFields = { action: actionSchema, revision: z.number().int().nonnegative() };
export const tutorialUpdateSchema = z.object(updateFields).strict();
export type TutorialAction = z.infer<typeof actionSchema>;
