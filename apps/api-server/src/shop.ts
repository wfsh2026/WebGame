import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Account, Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { shopPurchaseSchema, shopRefreshSchema } from '@web-game-world/contracts';
import type { ShopStateData, ShopTabId } from '@web-game-world/contracts';
import { starterEquipmentIds, canonicalEquipmentId, itemAtLevel, supportCompatible } from '@web-game-world/simulation';
import type { BuildItem, EquipmentItem } from '@web-game-world/simulation';
import { starterItems } from './starter-equipment';

const tabs: { id: ShopTabId; name: string; starterId: string }[] = [
  { id: 'hearts', name: '心法', starterId: starterEquipmentIds[0] },
  { id: 'skills', name: '技能', starterId: starterEquipmentIds[1] },
  { id: 'supports', name: '辅助宝石', starterId: starterEquipmentIds[2] }
];
export const shopRefreshCoins = 10;
const refreshIncrement = 5;
const shelfSize = 6;
export interface ShopProduct { id: string; tab: ShopTabId; level: number; coins: number; materials: number; weight: number }
const price = z.number().int().min(0).max(2147483647);
const grade = z.literal(1);
const productFields = { id: z.string().min(1), tab: z.enum(['hearts', 'skills', 'supports']), level: grade, coins: price, materials: price, weight: z.number().finite().positive().max(1000000) };
const productSchema = z.object(productFields).strict();
const offerFields = { id: z.string().transform(canonicalEquipmentId), level: grade, coins: price, materials: price, soldOut: z.boolean() };
const offerSchema = z.object(offerFields).strict();
const offersSchema = z.array(offerSchema).max(shelfSize);
const tabShelfFields = { offers: offersSchema, refreshCount: z.number().int().nonnegative() };
const tabShelfSchema = z.object(tabShelfFields).strict();
const progressFields = { hearts: z.boolean(), skills: z.boolean(), supports: z.boolean(), completed: z.boolean() };
const progressSchema = z.object(progressFields).strict();
const shelfFields = { version: z.literal(2), hearts: tabShelfSchema, skills: tabShelfSchema, supports: tabShelfSchema, progress: progressSchema };
const shelfSchema = z.object(shelfFields).strict();
type Offer = z.infer<typeof offerSchema>;
type Shelf = z.infer<typeof shelfSchema>;

function tabFor(item: EquipmentItem): ShopTabId {
  return item.kind === 'heart' ? 'hearts' : item.kind === 'support' ? 'supports' : 'skills';
}

export function parseShopProducts(text: string, catalog: EquipmentItem[]): ShopProduct[] {
  const trimmed = text.trim();
  const rows = trimmed.split(/\r?\n/);
  if (rows.shift() !== 'id,name,level,coins,materials,weight') throw new Error('商店配置表表头必须为 id,name,level,coins,materials,weight');
  const keys = new Set<string>();
  const products = rows.filter(row => row.trim() !== '').map(row => {
    const fields = row.split(',');
    if (fields.length !== 6 || fields.some(field => field.trim() === '')) throw new Error('商店配置表列数错误或存在空值');
    const id = fields[0].trim();
    const item = catalog.find(entry => entry.id === id);
    if (!item) throw new Error(`商店配置物品不存在：${id}`);
    const tab = tabFor(item);
    const level = Number(fields[2]); const coins = Number(fields[3]); const materials = Number(fields[4]); const weight = Number(fields[5]);
    const raw = { id, tab, level, coins, materials, weight };
    const product = productSchema.parse(raw);
    if (keys.has(id)) throw new Error('商店配置表商品重复');
    keys.add(id);
    return product;
  });
  for (const item of catalog) {
    if (!keys.has(item.id)) throw new Error(`商店配置缺少 ${item.id} Lv1`);
  }
  for (const tab of tabs) {
    const starter = products.find(product => product.id === tab.starterId);
    if (!starter || starter.tab !== tab.id || starter.materials !== 0) throw new Error('起步商品必须存在于对应分类，且仅消耗金币');
  }
  return products;
}

export function startingShopFunds(products: ShopProduct[]) {
  let coins = 50;
  for (const id of starterEquipmentIds) {
    const item = products.find(product => product.id === id);
    if (!item) throw new Error('商店配置缺少初始构筑');
    coins += item.coins;
  }
  const raw = { coins, materials: 0 };
  const fields = { coins: price, materials: price };
  const schema = z.object(fields);
  return schema.parse(raw);
}

interface ShopServices {
  database: PrismaClient;
  authenticate: (header: string | undefined) => Promise<Account>;
  catalog: EquipmentItem[];
  products: ShopProduct[];
}

export async function ownedEquipment(database: Pick<Prisma.TransactionClient, 'accountItem'>, accountId: string): Promise<BuildItem[]> {
  const items = await database.accountItem.findMany({ where: { accountId } });
  const purchased = items.map(item => {
    const definitionId = canonicalEquipmentId(item.definitionId ?? item.itemId);
    return { id: item.itemId, definitionId, level: 1, bonus: 0 };
  });
  const starters = starterItems();
  return [...starters, ...purchased];
}

function rollShelf(products: ShopProduct[], starterId?: string): Offer[] {
  let candidates = [...products];
  const offers: Offer[] = [];
  const starter = candidates.find(product => product.id === starterId);
  if (starter) {
    offers.push({ id: starter.id, level: 1, coins: starter.coins, materials: starter.materials, soldOut: false });
    candidates = candidates.filter(product => product.id !== starter.id);
  }
  while (candidates.length && offers.length < shelfSize) {
    const total = candidates.reduce((sum, product) => sum + product.weight, 0);
    const random = randomInt(0x100000000);
    let roll = random / 0x100000000 * total;
    let selected = candidates[candidates.length - 1];
    for (const product of candidates) { roll -= product.weight; if (roll < 0) { selected = product; break; } }
    offers.push({ id: selected.id, level: 1, coins: selected.coins, materials: selected.materials, soldOut: false });
    candidates = candidates.filter(product => product.id !== selected.id);
  }
  return offers;
}

export function registerShop(app: FastifyInstance, services: ShopServices): void {
  const { database, authenticate, catalog, products } = services;

  async function shopState(tx: Prisma.TransactionClient, accountId: string): Promise<ShopStateData> {
    const account = await tx.account.findUniqueOrThrow({ where: { id: accountId } });
    const items = await ownedEquipment(tx, accountId);
    const ownedDefinitionIds = items.map(item => item.definitionId ?? item.id);
    const owned = new Set(ownedDefinitionIds);
    const migrated = account.shopOffers === null || Array.isArray(account.shopOffers);
    let shelf: Shelf;
    if (migrated) {
      const empty = { offers: [], refreshCount: 0 };
      shelf = { version: 2, hearts: { ...empty }, skills: { ...empty }, supports: { ...empty }, progress: { hearts: false, skills: false, supports: false, completed: false } };
    } else shelf = shelfSchema.parse(account.shopOffers);
    const before = JSON.stringify(account.shopOffers);
    let compatible = shelf.progress.completed;
    if (!shelf.progress.completed) {
      const purchases = await tx.shopPurchase.findMany({ where: { accountId }, select: { itemId: true }, distinct: ['itemId'] });
      const acquired = new Set(ownedDefinitionIds);
      for (const purchase of purchases) {
        const id = canonicalEquipmentId(purchase.itemId);
        acquired.add(id);
      }
      const definitions = catalog.filter(item => acquired.has(item.id));
      const abilities = definitions.filter(item => item.kind === 'skill');
      const supports = definitions.filter(item => item.kind === 'support');
      for (const item of definitions) {
        const tabId = tabFor(item);
        shelf.progress[tabId] = true;
      }
      compatible = supports.some(support => abilities.some(ability => supportCompatible(support, ability)));
      shelf.progress.completed = shelf.progress.hearts && shelf.progress.skills && shelf.progress.supports && compatible;
    }
    if (migrated) {
      for (const tab of tabs) {
        const pool = products.filter(product => product.tab === tab.id);
        const starterId = shelf.progress.completed ? undefined : tab.starterId;
        const offers = rollShelf(pool, starterId);
        shelf[tab.id] = { offers, refreshCount: 0 };
      }
    }
    const after = JSON.stringify(shelf);
    const revision = migrated ? account.shopRevision + 1 : account.shopRevision;
    if (migrated || before !== after) await tx.account.update({ where: { id: accountId }, data: { shopOffers: shelf, shopRevision: revision } });
    const available: ShopStateData['products'] = [];
    const categories: ShopStateData['tabs'] = [];
    let totalCoins = 0; let remainingCoins = 0;
    for (const tab of tabs) {
      const category = shelf[tab.id];
      const starter = products.find(product => product.id === tab.starterId);
      if (!starter) throw new Error('商店配置缺少起步商品');
      totalCoins += starter.coins;
      if (!shelf.progress[tab.id]) remainingCoins += starter.coins;
      const canRefresh = products.some(product => product.tab === tab.id);
      const refreshCoins = shopRefreshCoins + category.refreshCount * refreshIncrement;
      const nextRefreshCoins = refreshCoins + refreshIncrement;
      categories.push({ id: tab.id, name: tab.name, refreshCount: category.refreshCount, refreshCoins, nextRefreshCoins, canRefresh, acquired: shelf.progress[tab.id] });
      for (const offer of category.offers) {
        const definition = catalog.find(entry => entry.id === offer.id);
        if (!definition || tabFor(definition) !== tab.id) throw new Error('商店商品配置缺失或分类不符');
        const item = itemAtLevel(definition, 1);
        const currentLevel = owned.has(offer.id) ? 1 : 0;
        const description = item.description ?? '';
        const recommended = !shelf.progress.completed && offer.id === tab.starterId;
        available.push({ ...offer, currentLevel, tab: tab.id, name: item.name, description, recommended });
      }
    }
    if (!compatible && shelf.progress.skills && shelf.progress.supports) {
      const starter = products.find(product => product.id === starterEquipmentIds[2]);
      remainingCoins += starter?.coins ?? 0;
    }
    const onboarding = { completed: shelf.progress.completed, compatible, totalCoins, remainingCoins };
    return { tabs: categories, products: available, coins: account.coins, materials: account.materials, revision, characterLevel: account.characterLevel, ownedDefinitionIds, onboarding };
  }

  app.get('/api/shop', async request => {
    const account = await authenticate(request.headers.authorization);
    if (!account.role) throw new Error('RULE:请先创建角色');
    return database.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${account.id} FOR UPDATE`;
      return shopState(tx, account.id);
    });
  });

  app.post('/api/shop/refresh', async request => {
    const account = await authenticate(request.headers.authorization);
    if (!account.role) throw new Error('RULE:请先创建角色');
    const data = shopRefreshSchema.parse(request.body);
    return database.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${account.id} FOR UPDATE`;
      const key = { accountId: account.id, requestId: data.requestId };
      const previous = await tx.shopRefresh.findUnique({ where: { accountId_requestId: key } });
      if (previous) {
        if (previous.sourceRevision !== data.revision || previous.tabId !== data.tabId) throw new Error('RULE:随机请求编号已被使用');
        return shopState(tx, account.id);
      }
      const current = await tx.account.findUniqueOrThrow({ where: { id: account.id } });
      if (current.activeRunId) throw new Error('RULE:请结束当前秘境后再使用大厅商店');
      if (current.shopRevision !== data.revision) throw new Error('RULE:商店已在其他页面更新，请同步货架');
      const shelf = shelfSchema.parse(current.shopOffers);
      const category = shelf[data.tabId];
      const refreshCoins = shopRefreshCoins + category.refreshCount * refreshIncrement;
      if (current.coins < refreshCoins) throw new Error(`RULE:随机需要 ${refreshCoins} 金币`);
      const tab = tabs.find(entry => entry.id === data.tabId);
      const pool = products.filter(product => product.tab === data.tabId);
      const starterId = shelf.progress.completed ? undefined : tab?.starterId;
      const offers = rollShelf(pool, starterId);
      if (!offers.length) throw new Error('RULE:该分类暂无可随机商品');
      category.offers = offers; category.refreshCount += 1;
      await tx.account.update({ where: { id: account.id }, data: { coins: { decrement: refreshCoins }, shopOffers: shelf, shopRevision: { increment: 1 } } });
      const receipt = { ...key, tabId: data.tabId, sourceRevision: data.revision, coins: refreshCoins };
      await tx.shopRefresh.create({ data: receipt });
      return shopState(tx, account.id);
    });
  });

  app.post('/api/shop/purchase', async request => {
    const account = await authenticate(request.headers.authorization);
    if (!account.role) throw new Error('RULE:请先创建角色');
    const requested = shopPurchaseSchema.parse(request.body);
    const productId = canonicalEquipmentId(requested.productId);
    const data = { ...requested, productId };
    return database.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${account.id} FOR UPDATE`;
      const requestKey = { accountId: account.id, requestId: data.requestId };
      const previous = await tx.shopPurchase.findUnique({ where: { accountId_requestId: requestKey } });
      if (previous) {
        const previousId = canonicalEquipmentId(previous.itemId);
        if (previousId !== data.productId || previous.shelfRevision !== data.revision || previous.tabId !== data.tabId) throw new Error('RULE:购买请求编号已被使用');
        return shopState(tx, account.id);
      }
      const current = await tx.account.findUniqueOrThrow({ where: { id: account.id } });
      if (current.activeRunId) throw new Error('RULE:请结束当前秘境后再使用大厅商店');
      if (current.shopRevision !== data.revision) throw new Error('RULE:货架已更新，请同步货架');
      const shelf = shelfSchema.parse(current.shopOffers);
      const offer = shelf[data.tabId].offers.find(item => item.id === data.productId);
      if (!offer || offer.soldOut) throw new Error('RULE:该商品已售罄或已下架');
      const count = await tx.accountItem.count({ where: { accountId: account.id } });
      if (count >= 100) throw new Error('RULE:大厅构筑库存已满');
      const definition = catalog.find(item => item.id === offer.id);
      if (!definition || tabFor(definition) !== data.tabId) throw new Error('RULE:商品分类无效');
      if (current.coins < offer.coins || current.materials < offer.materials) throw new Error(`RULE:需要 ${offer.coins} 金币和 ${offer.materials} 素材`);
      offer.soldOut = true;
      await tx.account.update({ where: { id: account.id }, data: { coins: { decrement: offer.coins }, materials: { decrement: offer.materials }, shopOffers: shelf, loadoutRevision: { increment: 1 } } });
      const itemId = randomUUID();
      const itemData = { accountId: account.id, itemId, definitionId: offer.id, level: 1 };
      await tx.accountItem.create({ data: itemData });
      const receipt = { ...requestKey, tabId: data.tabId, itemId: offer.id, level: 1, shelfRevision: data.revision, coins: offer.coins, materials: offer.materials };
      await tx.shopPurchase.create({ data: receipt });
      return shopState(tx, account.id);
    });
  });
}
