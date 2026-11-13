import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { Account, Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { shopPurchaseSchema, shopRefreshSchema } from '@web-game-world/contracts';
import { starterEquipmentIds, canonicalEquipmentId, itemAtLevel } from '@web-game-world/simulation';
import type { BuildItem, EquipmentItem } from '@web-game-world/simulation';

const tabs = [{ id: 'skills', name: '技能' }];
export const shopRefreshCoins = 10;
const shelfSize = 6;
interface ShopProduct { id: string; tab: string; level: number; coins: number; materials: number; weight: number }
const price = z.number().int().min(0).max(2147483647);
const grade = z.number().int().min(1).max(20);
const productFields = { id: z.string().min(1), tab: z.literal('skills'), level: grade, coins: price, materials: price, weight: z.number().finite().positive().max(1000000) };
const productSchema = z.object(productFields).strict();
const offerFields = { id: z.string(), level: grade, coins: price, materials: price, soldOut: z.boolean() };
const offerSchema = z.object(offerFields).strict();
const shelfSchema = z.array(offerSchema).max(shelfSize);
type Offer = z.infer<typeof offerSchema>;

export function parseShopProducts(text: string, catalog: EquipmentItem[]): ShopProduct[] {
  const trimmed = text.trim();
  const rows = trimmed.split(/\r?\n/);
  if (rows.shift() !== 'id,name,level,coins,materials,weight') throw new Error('商店配置表表头必须为 id,name,level,coins,materials,weight');
  const keys = new Set<string>();
  const products = rows.filter(row => row.trim() !== '').map(row => {
    const fields = row.split(',');
    if (fields.length !== 6 || fields.some(field => field.trim() === '')) throw new Error('商店配置表列数错误或存在空值');
    const level = Number(fields[2]); const coins = Number(fields[3]); const materials = Number(fields[4]); const weight = Number(fields[5]);
    const raw = { id: fields[0].trim(), tab: 'skills', level, coins, materials, weight };
    const product = productSchema.parse(raw);
    const item = catalog.find(entry => entry.id === product.id);
    const key = `${product.id}:${product.level}`;
    if (!item || keys.has(key) || product.level > 20) throw new Error('商店配置表商品等级重复或物品等级无效');
    keys.add(key);
    return product;
  });
  for (const item of catalog) {
    const maximum = 20;
    for (let level = 1; level <= maximum; level += 1) {
      if (!keys.has(`${item.id}:${level}`)) throw new Error(`商店配置缺少 ${item.id} Lv${level}`);
    }
  }
  return products;
}

export function startingShopFunds(products: ShopProduct[]) {
  let coins = shopRefreshCoins * 5; let materials = 0;
  for (const id of starterEquipmentIds) {
    const item = products.find(product => product.id === id && product.level === 1);
    if (!item) throw new Error('商店配置缺少初始构筑');
    coins += item.coins; materials += item.materials;
  }
  const raw = { coins, materials };
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
  const items = await database.accountItem.findMany({ where: { accountId }, select: { itemId: true, level: true } });
  const levels = new Map<string, number>();
  for (const item of items) {
    const id = canonicalEquipmentId(item.itemId);
    const previous = levels.get(id) ?? 0;
    const level = Math.max(previous, item.level);
    levels.set(id, level);
  }
  return [...levels].map(([id, level]) => ({ id, definitionId: id, level, bonus: 0 }));
}

function rollShelf(products: ShopProduct[], items: BuildItem[]): Offer[] {
  const entries = items.map(item => [item.definitionId, item.level] as const);
  const levels = new Map(entries);
  let candidates = products.filter(product => product.level > (levels.get(product.id) ?? 0));
  const offers: Offer[] = [];
  // 从所有有效的“物品＋等级”组合抽取，再移除该同名物品的全部等级。
  while (candidates.length && offers.length < shelfSize) {
    const total = candidates.reduce((sum, product) => sum + product.weight, 0);
    const random = randomInt(0x100000000);
    let roll = random / 0x100000000 * total;
    let selected = candidates[candidates.length - 1];
    for (const product of candidates) { roll -= product.weight; if (roll < 0) { selected = product; break; } }
    offers.push({ id: selected.id, level: selected.level, coins: selected.coins, materials: selected.materials, soldOut: false });
    candidates = candidates.filter(product => product.id !== selected.id);
  }
  return offers;
}

export function registerShop(app: FastifyInstance, services: ShopServices): void {
  const { database, authenticate, catalog, products } = services;

  async function shopState(tx: Prisma.TransactionClient, accountId: string) {
    const account = await tx.account.findUniqueOrThrow({ where: { id: accountId } });
    const items = await ownedEquipment(tx, accountId);
    const entries = items.map(item => [item.definitionId, item.level] as const);
    const levels = new Map(entries);
    const offers = account.shopOffers === null ? rollShelf(products, items) : shelfSchema.parse(account.shopOffers);
    if (account.shopOffers === null) await tx.account.update({ where: { id: accountId }, data: { shopOffers: offers } });
    const available = offers.map(offer => {
      const definition = catalog.find(entry => entry.id === offer.id);
      if (!definition) throw new Error('商店商品配置缺失');
      const item = itemAtLevel(definition, offer.level);
      const currentLevel = levels.get(offer.id) ?? 0;
      const soldOut = offer.soldOut || currentLevel >= offer.level;
      const fallback = item.kind === 'heart' ? `心法 · ${item.slots} 个能力槽 · 灵力池 ${item.capacity} · 每 ${item.interval} 秒恢复 ${item.recovery} 灵力` : item.kind === 'support' ? `辅助 · 伤害 ×${item.damageMultiplier} · 灵力消耗 ×${item.costMultiplier} · 投射物 ×${item.projectiles ?? 1}` : `${item.kind === 'weapon' ? '武器' : '法术'} · ${item.supportSlots} 个辅助槽 · 基础间隔 ${item.interval} 秒 · 消耗 ${item.cost} 灵力`;
      const description = item.description ?? fallback;
      return { ...offer, soldOut, currentLevel, tab: 'skills', name: item.name, description };
    });
    const canRefresh = products.some(product => product.level > (levels.get(product.id) ?? 0));
    return { tabs, products: available, coins: account.coins, materials: account.materials, revision: account.shopRevision, refreshCoins: shopRefreshCoins, canRefresh };
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
        if (previous.sourceRevision !== data.revision) throw new Error('RULE:刷新请求编号已被使用');
        return shopState(tx, account.id);
      }
      const current = await tx.account.findUniqueOrThrow({ where: { id: account.id } });
      if (current.shopRevision !== data.revision) throw new Error('RULE:商店已在其他页面刷新，请重新打开商店');
      const items = await ownedEquipment(tx, account.id);
      const offers = rollShelf(products, items);
      if (!offers.length) throw new Error('RULE:所有技能均已满级');
      if (current.coins < shopRefreshCoins) throw new Error(`RULE:刷新需要 ${shopRefreshCoins} 金币`);
      await tx.account.update({ where: { id: account.id }, data: { coins: { decrement: shopRefreshCoins }, shopOffers: offers, shopRevision: { increment: 1 } } });
      const receipt = { ...key, sourceRevision: data.revision, coins: shopRefreshCoins };
      await tx.shopRefresh.create({ data: receipt });
      return shopState(tx, account.id);
    });
  });

  app.post('/api/shop/purchase', async request => {
    const account = await authenticate(request.headers.authorization);
    if (!account.role) throw new Error('RULE:请先创建角色');
    const data = shopPurchaseSchema.parse(request.body);
    return database.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${account.id} FOR UPDATE`;
      const requestKey = { accountId: account.id, requestId: data.requestId };
      const previous = await tx.shopPurchase.findUnique({ where: { accountId_requestId: requestKey } });
      if (previous) {
        if (previous.itemId !== data.productId || previous.shelfRevision !== data.revision) throw new Error('RULE:购买请求编号已被使用');
        return shopState(tx, account.id);
      }
      const current = await tx.account.findUniqueOrThrow({ where: { id: account.id } });
      if (current.shopRevision !== data.revision || current.shopOffers === null) throw new Error('RULE:货架已更新，请重新打开商店');
      const offers = shelfSchema.parse(current.shopOffers);
      const offer = offers.find(item => item.id === data.productId);
      if (!offer || offer.soldOut) throw new Error('RULE:该商品已售罄或已下架');
      const items = await ownedEquipment(tx, account.id);
      const owned = items.find(item => item.definitionId === offer.id);
      if ((owned?.level ?? 0) >= offer.level) throw new Error('RULE:当前技能已达到或超过该技能书等级');
      const definition = catalog.find(item => item.id === offer.id);
      if (!definition || offer.level > 20) throw new Error('RULE:技能书等级无效');
      if (current.coins < offer.coins || current.materials < offer.materials) throw new Error(`RULE:需要 ${offer.coins} 金币和 ${offer.materials} 素材`);
      offer.soldOut = true;
      await tx.account.update({ where: { id: account.id }, data: { coins: { decrement: offer.coins }, materials: { decrement: offer.materials }, shopOffers: offers, loadoutRevision: { increment: 1 } } });
      const itemKey = { accountId: account.id, itemId: offer.id };
      await tx.accountItem.upsert({ where: { accountId_itemId: itemKey }, create: { ...itemKey, level: offer.level }, update: { level: offer.level } });
      const receipt = { ...requestKey, itemId: offer.id, level: offer.level, shelfRevision: data.revision, coins: offer.coins, materials: offer.materials };
      await tx.shopPurchase.create({ data: receipt });
      return shopState(tx, account.id);
    });
  });
}
