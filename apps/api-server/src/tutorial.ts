import type { Account, Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { equipmentLoadoutSchema, initialTutorialProgress, tutorialProgressSchema, tutorialUpdateSchema } from '@web-game-world/contracts';
import type { TutorialAction, TutorialMilestone, TutorialProgressData, TutorialStateData } from '@web-game-world/contracts';
import { buildCatalog, calculateCharacterStats, canonicalEquipmentId, characterGrowthSpent, equipmentError, equipmentRuntime, heartCapacity, supportCompatible } from '@web-game-world/simulation';
import type { EquipmentConfig, EquipmentItem } from '@web-game-world/simulation';
import { characterBuildSchema, characterGrowthSchema } from '@web-game-world/contracts';
import { ownedEquipment } from './shop';

interface Services { database: PrismaClient; authenticate: (header: string | undefined) => Promise<Account>; catalog: EquipmentItem[]; content: EquipmentConfig }
interface TutorialAccount { account: Account; progress: TutorialProgressData; state: TutorialStateData; completeBuild: boolean }

function remember(progress: TutorialProgressData, milestone: TutorialMilestone): void {
  if (!progress.milestones.includes(milestone)) progress.milestones.push(milestone);
}

export function registerTutorial(app: FastifyInstance, services: Services): void {
  const { database, authenticate, catalog, content } = services;

  async function read(tx: Prisma.TransactionClient, accountId: string): Promise<TutorialAccount> {
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${accountId} FOR UPDATE`;
    const accountQuery = { where: { id: accountId } };
    const account = await tx.account.findUniqueOrThrow(accountQuery);
    const fallback = { ...initialTutorialProgress, enabled: false, milestones: [] };
    const raw = account.tutorial ?? fallback;
    const progress = tutorialProgressSchema.parse(raw);
    const before = JSON.stringify(progress.milestones);
    const distinct: Prisma.ShopPurchaseScalarFieldEnum[] = ['itemId'];
    const purchaseQuery = { where: { accountId }, select: { itemId: true }, distinct };
    const receipts = await tx.shopPurchase.findMany(purchaseQuery);
    const ids = receipts.map(receipt => canonicalEquipmentId(receipt.itemId));
    const definitions = catalog.filter(item => ids.includes(item.id));
    const hearts = definitions.some(item => item.kind === 'heart');
    const skills = definitions.filter(item => item.kind === 'skill');
    const supports = definitions.filter(item => item.kind === 'support');
    const compatible = supports.some(support => { const matches = skills.some(skill => supportCompatible(support, skill)); return matches; });
    const purchases = { hearts, skills: skills.length > 0, supports: supports.length > 0, compatible };
    if (hearts && purchases.skills && compatible) remember(progress, 'shop');
    const settledQuery = { where: { accountId, settled: true }, select: { runId: true } };
    const settled = await tx.participant.findFirst(settledQuery);
    if (settled) { remember(progress, 'entered'); remember(progress, 'settled'); }
    if (account.characterLevel > 1) remember(progress, 'upgraded');
    const growth = characterGrowthSchema.parse(account.characterGrowth);
    const spent = characterGrowthSpent(growth);
    if (spent > 0) remember(progress, 'allocated');
    const items = await ownedEquipment(tx, accountId);
    const currentCatalog = buildCatalog(content, items);
    const parsedLoadout = equipmentLoadoutSchema.safeParse(account.loadout);
    let completeBuild = false;
    if (parsedLoadout.success && !account.activeRunId) {
      const loadout = parsedLoadout.data;
      const ownedIds = items.map(item => item.id);
      const context = { catalog: currentCatalog, ownedIds, characterLevel: account.characterLevel };
      const invalid = equipmentError(loadout, context);
      const runtime = equipmentRuntime(loadout, content, items);
      const character = characterBuildSchema.safeParse(account.character);
      const stats = character.success ? calculateCharacterStats(character.data, growth) : null;
      const capacity = heartCapacity(runtime.heartItem, stats?.energyCapacityBonus ?? 0);
      completeBuild = !invalid && runtime.branches.some(branch => branch.supportIds.length > 0 && branch.item.cost * branch.costMultiplier <= capacity);
    }
    const after = JSON.stringify(progress.milestones);
    if (account.tutorial !== null && before !== after) {
      progress.revision += 1;
      const update = { where: { id: accountId }, data: { tutorial: progress } };
      await tx.account.update(update);
    }
    const state: TutorialStateData = { ...progress, purchases };
    return { account, progress, state, completeBuild };
  }

  function apply(current: TutorialAccount, action: TutorialAction): void {
    const { account, progress, completeBuild } = current;
    if (action === 'enable') { progress.enabled = true; progress.collapsed = false; }
    else if (action === 'disable') progress.enabled = false;
    else if (action === 'collapse') progress.collapsed = true;
    else if (action === 'expand') progress.collapsed = false;
    else if (action === 'shop-reviewed') remember(progress, 'shop');
    else if (action === 'build-reviewed') {
      if (!completeBuild) throw new Error('RULE:请先保存心法、技能与兼容辅助的完整构筑');
      remember(progress, 'build');
    } else if (action === 'growth-viewed') remember(progress, 'growth-viewed');
    else {
      if (!account.activeRunId && !progress.milestones.includes('entered')) return;
      remember(progress, 'entered');
      if (action === 'reward-picked') remember(progress, 'reward');
      if (action === 'battle-build-viewed') remember(progress, 'battle-build');
    }
  }

  app.get('/api/tutorial', async request => {
    const account = await authenticate(request.headers.authorization);
    if (!account.role) throw new Error('RULE:请先创建角色');
    return database.$transaction(async tx => { const current = await read(tx, account.id); return current.state; });
  });
  app.post('/api/tutorial', async request => {
    const account = await authenticate(request.headers.authorization);
    if (!account.role) throw new Error('RULE:请先创建角色');
    const data = tutorialUpdateSchema.parse(request.body);
    return database.$transaction(async tx => {
      const current = await read(tx, account.id);
      // 教学里程碑可重复合并；较旧页面不能覆盖另一页面的新显示设置。
      const preference = ['enable', 'disable', 'collapse', 'expand'].includes(data.action);
      const stored = current.account.tutorial === null ? null : tutorialProgressSchema.parse(current.account.tutorial);
      if (preference && (stored?.revision ?? 0) !== data.revision) throw new Error('RULE:新手指引已在其他页面更新，请同步后重试');
      apply(current, data.action);
      current.progress.revision += 1;
      const update = { where: { id: account.id }, data: { tutorial: current.progress } };
      await tx.account.update(update);
      return { ...current.progress, purchases: current.state.purchases };
    });
  });
}
