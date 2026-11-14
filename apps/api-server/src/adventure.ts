import { randomUUID } from 'node:crypto';
import type { Account, Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { buildItemSchema, buildCopySchema, characterUpgradeSchema, characterGrowthSaveSchema, equipmentLoadoutSchema, profileSchema, runRefreshSchema, runRefreshReceiptSchema } from '@web-game-world/contracts';
import { buildCatalog, characterGrowthSpent, characterUpgradePrice, equipmentError, equipmentRuntime, equippedIds, growthRefreshPrices, migrateLoadout, canonicalLoadout } from '@web-game-world/simulation';
import type { EquipmentConfig, EquipmentLoadout } from '@web-game-world/simulation';
import { ownedEquipment } from './shop';
import type { ShopProduct } from './shop';
import { starterLoadout } from './starter-equipment';

interface AdventureServices {
  database: PrismaClient;
  authenticate: (header: string | undefined) => Promise<Account>;
  content: EquipmentConfig;
  products: ShopProduct[];
  internal: (header: string | string[] | undefined) => void;
}

function copyQuote(previous: EquipmentLoadout | null, products: ShopProduct[]) {
  let base = 0;
  if (!previous) return { base, coins: 0, error: '完成首次入场后可复制上一局构筑' };
  const ids = equippedIds(previous);
  if (!ids.length) return { base, coins: 0, error: '上一局没有可复制的构筑' };
  for (const id of ids) {
    const product = products.find(item => item.id === id && item.level === 1);
    if (!product) return { base: 0, coins: 0, error: '上一局构筑包含已下架物品' };
    base += product.coins;
  }
  const surcharge = Math.ceil(base * .5);
  return { base, coins: base + surcharge, error: '' };
}

export async function adventureEquipment(tx: Prisma.TransactionClient, data: { accountId: string; content: EquipmentConfig; products: ShopProduct[] }) {
  const account = await tx.account.findUniqueOrThrow({ where: { id: data.accountId } });
  const items = await ownedEquipment(tx, account.id);
  const saved = account.loadout === null ? { heart: null, slots: [] } : equipmentLoadoutSchema.parse(account.loadout);
  const options = { items, characterLevel: account.characterLevel };
  const loadout = migrateLoadout(saved, data.content, options);
  const previous = account.previousLoadout === null ? null : equipmentLoadoutSchema.parse(account.previousLoadout);
  const previousLoadout = previous ? canonicalLoadout(previous) : null;
  const quote = copyQuote(previousLoadout, data.products);
  const ownedIds = items.map(item => item.id);
  return { loadout, items, ownedIds, revision: account.loadoutRevision, characterLevel: account.characterLevel, coins: account.coins, previousLoadout, copyBaseCoins: quote.base, copyCoins: quote.coins, copyError: quote.error };
}

export async function ensureLobbyLoadout(tx: Prisma.TransactionClient, data: { accountId: string; content: EquipmentConfig }): Promise<Account> {
  await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${data.accountId} FOR UPDATE`;
  const account = await tx.account.findUniqueOrThrow({ where: { id: data.accountId } });
  if (!account.role || account.activeRunId) return account;
  const items = await ownedEquipment(tx, account.id);
  const saved = account.loadout === null ? { heart: null, slots: [] } : equipmentLoadoutSchema.parse(account.loadout);
  const options = { items, characterLevel: account.characterLevel };
  const loadout = migrateLoadout(saved, data.content, options);
  const runtime = equipmentRuntime(loadout, data.content, items);
  if (runtime.branches.length > 0) return account;
  const fallback = starterLoadout(account.characterLevel);
  const changes = { loadout: fallback, loadoutRevision: { increment: 1 } };
  return tx.account.update({ where: { id: account.id }, data: changes });
}

export function registerAdventure(app: FastifyInstance, services: AdventureServices): void {
  const { database, authenticate, content, products, internal } = services;
  app.post('/api/character/growth', async request => {
    const account = await authenticate(request.headers.authorization);
    const data = characterGrowthSaveSchema.parse(request.body);
    const payload = JSON.stringify(data);
    const signature = `character-growth:${payload}`;
    return database.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${account.id} FOR UPDATE`;
      const key = { accountId: account.id, requestId: data.requestId };
      const previous = await tx.adventurePurchase.findUnique({ where: { accountId_requestId: key } });
      const current = await tx.account.findUniqueOrThrow({ where: { id: account.id } });
      if (previous) {
        if (previous.kind !== signature) throw new Error('RULE:请求编号已用于其他操作');
        return profileSchema.parse(current);
      }
      if (!current.role || current.activeRunId) throw new Error('RULE:请在游戏大厅分配成长点');
      if (current.characterGrowthRevision !== data.revision) throw new Error('RULE:成长点分配已更新，已刷新角色，请重新分配');
      const spent = characterGrowthSpent(data.points);
      if (spent > current.characterLevel - 1) throw new Error('RULE:可用成长点不足');
      const changes = { characterGrowth: data.points, characterGrowthRevision: { increment: 1 } };
      const updated = await tx.account.update({ where: { id: account.id }, data: changes });
      const receipt = { ...key, kind: signature, coins: 0, receipt: { points: data.points, revision: updated.characterGrowthRevision } };
      await tx.adventurePurchase.create({ data: receipt });
      return profileSchema.parse(updated);
    });
  });
  app.post('/api/character/upgrade', async request => {
    const account = await authenticate(request.headers.authorization);
    const data = characterUpgradeSchema.parse(request.body);
    const signature = JSON.stringify(data);
    return database.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${account.id} FOR UPDATE`;
      const key = { accountId: account.id, requestId: data.requestId };
      const previous = await tx.adventurePurchase.findUnique({ where: { accountId_requestId: key } });
      if (previous) {
        if (previous.kind !== signature) throw new Error('RULE:请求编号已用于其他操作');
        const current = await tx.account.findUniqueOrThrow({ where: { id: account.id } });
        return profileSchema.parse(current);
      }
      const current = await tx.account.findUniqueOrThrow({ where: { id: account.id } });
      if (!current.role || current.activeRunId) throw new Error('RULE:请在游戏大厅升级角色');
      if (current.characterLevel !== data.level) throw new Error('RULE:角色等级已变化，请刷新后重试');
      const coins = characterUpgradePrice(current.characterLevel);
      if (!coins || current.coins < coins) throw new Error(`RULE:升级需要 ${coins} 金币`);
      const changes = { characterLevel: { increment: 1 }, coins: { decrement: coins }, loadoutRevision: { increment: 1 } };
      const upgraded = await tx.account.update({ where: { id: account.id }, data: changes });
      const receipt = { ...key, kind: signature, coins, receipt: { level: upgraded.characterLevel } };
      await tx.adventurePurchase.create({ data: receipt });
      return profileSchema.parse(upgraded);
    });
  });
  app.post('/api/equipment/copy', async request => {
    const account = await authenticate(request.headers.authorization);
    const data = buildCopySchema.parse(request.body);
    const signature = JSON.stringify(data);
    return database.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${account.id} FOR UPDATE`;
      const key = { accountId: account.id, requestId: data.requestId };
      const previous = await tx.adventurePurchase.findUnique({ where: { accountId_requestId: key } });
      if (previous && previous.kind !== signature) throw new Error('RULE:请求编号已用于其他操作');
      const stateData = { accountId: account.id, content, products };
      if (previous) return adventureEquipment(tx, stateData);
      const current = await tx.account.findUniqueOrThrow({ where: { id: account.id } });
      if (!current.role || current.activeRunId) throw new Error('RULE:请结束秘境后再购买构筑');
      const state = await adventureEquipment(tx, stateData);
      if (state.copyError || !state.previousLoadout) throw new Error(`RULE:${state.copyError}`);
      if (current.loadoutRevision !== data.revision || state.copyCoins !== data.coins) throw new Error('RULE:构筑或价格已变化，请刷新后重试');
      if (current.coins < state.copyCoins) throw new Error(`RULE:复制需要 ${state.copyCoins} 金币，包含50%快捷购买费用`);
      const ids = equippedIds(state.previousLoadout);
      const count = await tx.accountItem.count({ where: { accountId: account.id } });
      if (count + ids.length > 100) throw new Error('RULE:大厅构筑库存空间不足');
      const replacements = new Map<string, string[]>();
      for (const definitionId of ids) {
        const itemId = randomUUID();
        const itemData = { accountId: account.id, itemId, definitionId, level: 1 };
        await tx.accountItem.create({ data: itemData });
        const group = replacements.get(definitionId) ?? [];
        group.push(itemId); replacements.set(definitionId, group);
      }
      const take = (id: string | null): string | null => id ? replacements.get(id)?.shift() ?? null : null;
      const heart = take(state.previousLoadout.heart);
      const slots = state.previousLoadout.slots.map(slot => {
        if (!slot) return null;
        const itemId = take(slot.itemId);
        const supports = slot.supports.map(take);
        return itemId ? { itemId, supports } : null;
      });
      const saved = { heart, slots };
      const changes = { coins: { decrement: state.copyCoins }, loadout: saved, loadoutRevision: { increment: 1 } };
      await tx.account.update({ where: { id: account.id }, data: changes });
      const receipt = { ...key, kind: signature, coins: state.copyCoins, receipt: saved };
      await tx.adventurePurchase.create({ data: receipt });
      return adventureEquipment(tx, stateData);
    });
  });
  app.post('/internal/growth-refresh', async request => {
    internal(request.headers['x-internal-secret']);
    const data = runRefreshSchema.parse(request.body);
    return database.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Run" WHERE "id" = ${data.runId} FOR UPDATE`;
      const key = { runId: data.runId, accountId: data.accountId, requestId: data.requestId };
      const previous = await tx.growthRefresh.findUnique({ where: { runId_accountId_requestId: key } });
      if (previous) {
        if (previous.choiceId !== data.choiceId || previous.refreshCount !== data.refreshCount) throw new Error('RULE:刷新请求编号已被使用');
        return runRefreshReceiptSchema.parse(previous.receipt);
      }
      const versionKey = { runId: data.runId, accountId: data.accountId, choiceId: data.choiceId, refreshCount: data.refreshCount };
      const committed = await tx.growthRefresh.findUnique({ where: { runId_accountId_choiceId_refreshCount: versionKey } });
      if (committed) return runRefreshReceiptSchema.parse(committed.receipt);
      const run = await tx.run.findUniqueOrThrow({ where: { id: data.runId } });
      const playerKey = { runId: data.runId, accountId: data.accountId };
      const player = await tx.participant.findUniqueOrThrow({ where: { runId_accountId: playerKey } });
      if (run.status !== 'active' || player.settled) throw new Error('RULE:本局已经结束');
      const count = await tx.growthRefresh.count({ where: { ...playerKey, choiceId: data.choiceId } });
      if (count !== data.refreshCount) throw new Error('RULE:候选项已刷新，请读取最新状态');
      const earned = Math.max(player.earned, data.earned);
      const coins = growthRefreshPrices[data.source];
      if (earned - player.spent < coins) throw new Error('RULE:本局金币不足');
      const spent = player.spent + coins;
      const receipt = { options: data.options, earned, spent, refreshCount: count + 1 };
      const record = { ...key, choiceId: data.choiceId, refreshCount: count, source: data.source, coins, receipt };
      await tx.growthRefresh.create({ data: record });
      await tx.participant.update({ where: { runId_accountId: playerKey }, data: { earned, spent } });
      return receipt;
    });
  });
}

export async function enterAdventure(tx: Prisma.TransactionClient, data: { accountId: string; runId: string; content: EquipmentConfig }) {
  const account = await ensureLobbyLoadout(tx, data);
  if (!account.role || account.activeRunId) throw new Error('RULE:玩家已有活动秘境，请先结束该场冒险');
  const owned = await ownedEquipment(tx, account.id);
  const saved = account.loadout === null ? { heart: null, slots: [] } : equipmentLoadoutSchema.parse(account.loadout);
  const options = { items: owned, characterLevel: account.characterLevel };
  const loadout = migrateLoadout(saved, data.content, options);
  const catalog = buildCatalog(data.content, owned);
  const ownedIds = owned.map(item => item.id);
  const context = { catalog, ownedIds, characterLevel: account.characterLevel };
  const invalid = equipmentError(loadout, context);
  if (invalid) throw new Error(`RULE:${invalid}`);
  const ids = equippedIds(loadout);
  const items = owned.filter(item => ids.includes(item.id));
  const entries = items.map(item => [item.id, item.definitionId] as const);
  const definitions = new Map(entries);
  const heart = loadout.heart ? definitions.get(loadout.heart) ?? null : null;
  const slots = loadout.slots.map(slot => slot ? { itemId: definitions.get(slot.itemId) ?? slot.itemId, supports: slot.supports.map(id => id ? definitions.get(id) ?? id : null) } : null);
  const previousLoadout = { heart, slots };
  await tx.accountItem.deleteMany({ where: { accountId: account.id, itemId: { in: ids } } });
  const changes = { activeRunId: data.runId, previousLoadout, loadout: { heart: null, slots: [] }, loadoutRevision: { increment: 1 } };
  await tx.account.update({ where: { id: account.id }, data: changes });
  const profileData = { ...account, loadout };
  const profile = profileSchema.parse(profileData);
  return { profile, items, ownedIds: ids };
}

export async function restoreAdventure(tx: Prisma.TransactionClient, runId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Run" WHERE "id" = ${runId} FOR UPDATE`;
  const run = await tx.run.findUnique({ where: { id: runId }, include: { participants: true } });
  if (!run || run.status !== 'active') return;
  const participants = [...run.participants].sort((a, b) => a.accountId.localeCompare(b.accountId));
  for (const player of participants) {
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${player.accountId} FOR UPDATE`;
    const account = await tx.account.findUniqueOrThrow({ where: { id: player.accountId } });
    if (account.activeRunId !== runId) continue;
    const rawItems = player.entryItems;
    if (Array.isArray(rawItems)) {
      for (const raw of rawItems) {
        const item = buildItemSchema.parse(raw);
        if (item.id.startsWith('starter:')) continue;
        const itemData = { accountId: account.id, itemId: item.id, definitionId: item.definitionId, level: item.level };
        await tx.accountItem.createMany({ data: [itemData], skipDuplicates: true });
      }
    }
    const loadout = equipmentLoadoutSchema.parse(player.entryLoadout);
    const changes = { activeRunId: null, loadout, loadoutRevision: { increment: 1 } };
    await tx.account.update({ where: { id: account.id }, data: changes });
  }
  await tx.run.update({ where: { id: runId }, data: { status: 'interrupted' } });
}
