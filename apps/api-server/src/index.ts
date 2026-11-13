import { settleInsuredLoot } from './insured-loot';
import { protocolVersion } from '@web-game-world/contracts';
import { migrateLoadout } from '@web-game-world/simulation';
import { registerTestTools } from './test-tools';
import { registerInventory } from './inventory';
import { contentSchema, resolveContentSupports } from '@web-game-world/content-schema';
import { registerShop, ownedEquipment, parseShopProducts, startingShopFunds } from './shop';
import { readFile } from 'node:fs/promises';
import { equipmentLoadoutSchema, equipmentSaveSchema } from '@web-game-world/contracts';
import { defaultEquipment, equipmentCatalog, equipmentError, buildCatalog } from '@web-game-world/simulation';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { credentialsSchema, finishSchema, profileSchema, runSchema, submitSchema, roundResultSchema } from '@web-game-world/contracts';
import { z } from 'zod';
import { characterCreationSchema } from '@web-game-world/contracts';
import { survivalScore, characterBudget, startingLoadoutAllowsShallow } from '@web-game-world/simulation';

const contentUrl = new URL('../../../content/packs/forest-survival/manifest.json', import.meta.url);
const contentText = await readFile(contentUrl, 'utf8');
const rawContent: unknown = JSON.parse(contentText);
const parsedContent = contentSchema.parse(rawContent);
const supportSources: Record<string, unknown> = {};
const contentFiles = [...(parsedContent.supportFiles ?? []), ...(parsedContent.equipmentFiles ?? [])];
for (const reference of contentFiles) {
  const url = new URL(reference.path, contentUrl);
  const source = await readFile(url, 'utf8');
  supportSources[reference.path] = JSON.parse(source);
}
const equipmentContent = resolveContentSupports(parsedContent, supportSources);
const catalog = equipmentCatalog(equipmentContent);
const database = new PrismaClient();
const app = Fastify({ logger: { level: 'warn' }, bodyLimit: 16384, trustProxy: 1 });
const derive = promisify(scrypt);
const secret = process.env.INTERNAL_SECRET;
if (!secret || secret.length < 32) throw new Error('INTERNAL_SECRET 未配置');
const limiter = { max: 90, timeWindow: '1 minute', allowList: (request: FastifyRequest) => request.url.startsWith('/internal/') };
await app.register(rateLimit, limiter);
const profileSelect = { loadout: true, id: true, name: true, role: true, character: true, coins: true, materials: true };
function digest(value: string): string { const hash = createHash('sha256'); hash.update(value); return hash.digest('hex'); }
async function passwordHash(password: string): Promise<string> { const bytes = randomBytes(16); const salt = bytes.toString('hex'); const derived = await derive(password, salt, 64); const hash = Buffer.from(derived); const encoded = hash.toString('hex'); return `${salt}:${encoded}`; }
async function passwordMatches(password: string, stored: string): Promise<boolean> { const [salt, encoded] = stored.split(':'); const derived = await derive(password, salt, 64); const hash = Buffer.from(derived); const expected = Buffer.from(encoded, 'hex'); return hash.length === expected.length && timingSafeEqual(hash, expected); }
async function authenticate(header: string | undefined) { if (!header?.startsWith('Bearer ')) throw new Error('UNAUTHORIZED'); const token = header.slice(7); const tokenHash = digest(token); const session = await database.session.findUnique({ where: { tokenHash }, include: { account: true } }); if (!session || session.expiresAt.getTime() <= Date.now()) throw new Error('UNAUTHORIZED'); return session.account; }
async function sessionFor(accountId: string): Promise<string> { const bytes = randomBytes(32); const token = bytes.toString('hex'); const tokenHash = digest(token); const expiresAt = new Date(Date.now() + 7 * 86400000); await database.session.create({ data: { tokenHash, accountId, expiresAt } }); return token; }
function internal(header: string | string[] | undefined): void { if (typeof header !== 'string') throw new Error('UNAUTHORIZED'); const actual = digest(header); const expected = digest(secret ?? ''); const actualBuffer = Buffer.from(actual); const expectedBuffer = Buffer.from(expected); const valid = timingSafeEqual(actualBuffer, expectedBuffer); if (!valid) throw new Error('UNAUTHORIZED'); }
app.setErrorHandler((error, request, reply) => {
  const message = error instanceof Error ? error.message : '请求失败';
  if (message === 'UNAUTHORIZED') return reply.code(401).send({ error: '登录已失效，请重新登录' });
  if (error instanceof z.ZodError) return reply.code(400).send({ error: '输入格式不正确' });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return reply.code(409).send({ error: '账号名已被使用，或记录已存在' });
  if (message.startsWith('RULE:')) { const detail = message.slice(5); return reply.code(409).send({ error: detail }); }
  request.log.error({ message: 'API 请求处理失败', path: request.routeOptions.url });
  return reply.code(500).send({ error: '服务暂不可用，请稍后重试' });
});
const pricesUrl = new URL('../../../content/shops/skills.csv', import.meta.url);
const pricesText = await readFile(pricesUrl, 'utf8');
const products = parseShopProducts(pricesText, catalog);
const startingFunds = startingShopFunds(products);
const shopServices = { database, authenticate, catalog, products };
registerShop(app, shopServices);
registerTestTools(app, shopServices);
registerInventory(app, shopServices);

app.get('/api/health', async () => { await database.$queryRaw`SELECT 1`; return { status: 'ok', protocol: protocolVersion }; });
app.post('/api/register', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async request => {
  const credentials = credentialsSchema.parse(request.body); const hash = await passwordHash(credentials.password);
  const account = await database.account.create({ data: { name: credentials.name, passwordHash: hash }, select: profileSelect }); const token = await sessionFor(account.id); return { token, profile: account };
});
app.post('/api/login', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (request, reply) => {
  const credentials = credentialsSchema.parse(request.body); const account = await database.account.findUnique({ where: { name: credentials.name } });
  const valid = account ? await passwordMatches(credentials.password, account.passwordHash) : false;
  if (!account || !valid) return reply.code(401).send({ error: '账号或密码错误' });
  const profile = profileSchema.parse(account); const token = await sessionFor(account.id); return { token, profile };
});
app.get('/api/me', async request => { const account = await authenticate(request.headers.authorization); return profileSchema.parse(account); });
app.post('/api/logout', async request => { const header = request.headers.authorization; await authenticate(header); const token = header?.slice(7) ?? ''; const tokenHash = digest(token); await database.session.deleteMany({ where: { tokenHash } }); return { ok: true }; });
app.post('/api/character', async request => {
  const account = await authenticate(request.headers.authorization);
  const data = characterCreationSchema.parse(request.body);
  if (data.character) {
    // 由服务器的起始构筑政策决定弱点资格，不接受客户端勾选声明。
    const budget = characterBudget(data.character, startingLoadoutAllowsShallow);
    if (!budget.valid) { const detail = budget.errors.join('；'); throw new Error(`RULE:${detail}`); }
  }
  const characterChanges = data.character ? { role: data.role, character: data.character } : { role: data.role };
  const changes = { ...characterChanges, coins: { increment: startingFunds.coins }, materials: { increment: startingFunds.materials } };
  const current = await database.$transaction(async tx => {
    const result = await tx.account.updateMany({ where: { id: account.id, role: null }, data: changes });
    if (result.count === 0) throw new Error('RULE:初始角色已经创建，请刷新查看现有角色');
    await tx.characterFunding.create({ data: { accountId: account.id, ...startingFunds } });
    return tx.account.findUniqueOrThrow({ where: { id: account.id }, select: profileSelect });
  });
  return profileSchema.parse(current);
});
async function equipmentState(tx: Prisma.TransactionClient, accountId: string) {
  const account = await tx.account.findUniqueOrThrow({ where: { id: accountId } });
  const items = await ownedEquipment(tx, accountId);
  const saved = account.loadout === null ? defaultEquipment(equipmentContent) : equipmentLoadoutSchema.parse(account.loadout);
  const loadout = migrateLoadout(saved, equipmentContent, items);
  const ownedIds = items.map(item => item.id);
  return { loadout, ownedIds, items, revision: account.loadoutRevision };
}
app.get('/api/equipment', async request => {
  const account = await authenticate(request.headers.authorization);
  if (!account.role) throw new Error('RULE:请先创建角色');
  return database.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${account.id} FOR UPDATE`;
    return equipmentState(tx, account.id);
  });
});
app.post('/api/equipment', async request => {
  const account = await authenticate(request.headers.authorization);
  if (!account.role) throw new Error('RULE:请先创建角色');
  const data = equipmentSaveSchema.parse(request.body);
  return database.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${account.id} FOR UPDATE`;
    const items = await ownedEquipment(tx, account.id);
    const ownedIds = items.map(item => item.id);
    const leveledCatalog = buildCatalog(equipmentContent, items);
    const context = { catalog: leveledCatalog, ownedIds };
    const invalid = equipmentError(data.loadout, context);
    if (invalid) throw new Error(`RULE:${invalid}`);
    const changed = await tx.account.updateMany({ where: { id: account.id, loadoutRevision: data.revision }, data: { loadout: data.loadout, loadoutRevision: { increment: 1 } } });
    if (changed.count !== 1) throw new Error('RULE:装备或技能等级已更新，请重新打开技能搭配后重试');
    return { loadout: data.loadout, ownedIds, items, revision: data.revision + 1 };
  });
});
app.get('/api/history', async request => { const account = await authenticate(request.headers.authorization); return database.participant.findMany({ where: { accountId: account.id }, select: { runId: true, settled: true, coins: true, materials: true, run: { select: { status: true, createdAt: true } } }, orderBy: { run: { createdAt: 'desc' } }, take: 10 }); });
app.get('/api/rooms', async request => { await authenticate(request.headers.authorization); const endpoint = `${process.env.ROOM_INTERNAL_URL ?? 'http://127.0.0.1:3102'}/rooms`; const response = await fetch(endpoint); if (!response.ok) throw new Error('房间服务不可用'); return response.json(); });
app.post('/internal/verify', async request => {
  internal(request.headers['x-internal-secret']);
  const fields = { token: z.string().min(20).max(200) }; const schema = z.object(fields).strict();
  const data = schema.parse(request.body); const header = `Bearer ${data.token}`;
  const account = await authenticate(header);
  if (!account.role) throw new Error('RULE:请先选择初始角色');
  return database.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${account.id} FOR UPDATE`;
    const current = await tx.account.findUniqueOrThrow({ where: { id: account.id } });
    const profile = profileSchema.parse(current);
    const items = await ownedEquipment(tx, account.id); const ownedIds = items.map(item => item.id);
    return { profile, ownedIds, items };
  });
});
app.post('/internal/runs', async request => {
  internal(request.headers['x-internal-secret']); const data = runSchema.parse(request.body); const unique = new Set(data.players); if (unique.size !== data.players.length) throw new Error('RULE:重复玩家');
  const accounts = await database.account.count({ where: { id: { in: data.players }, role: { not: null } } }); if (accounts !== data.players.length) throw new Error('RULE:玩家资格无效');
  const existing = await database.run.findUnique({ where: { id: data.id } }); if (existing) { if (existing.roomId !== data.roomId) throw new Error('RULE:场次冲突'); return { ok: true }; }
  const participants = data.players.map(accountId => ({ accountId }));
  await database.run.create({ data: { id: data.id, roomId: data.roomId, contentVersion: data.contentVersion, ruleVersion: data.ruleVersion, participants: { create: participants } } }); return { ok: true };
});
app.post('/internal/rounds', { bodyLimit: 4 * 1024 * 1024 }, async request => {
  internal(request.headers['x-internal-secret']); const data = submitSchema.parse(request.body); const run = await database.run.findUniqueOrThrow({ where: { id: data.runId }, include: { participants: true, rounds: true } });
  const existing = run.rounds.find(item => item.round === data.result.round); if (existing) return { ok: true };
  if (run.status !== 'active' || data.result.round !== run.rounds.length + 1 || run.rounds.some(item => !item.success)) throw new Error('RULE:轮次顺序不正确');
  const playerIds = data.result.players.map(player => player.id); const ids = new Set(playerIds); if (ids.size !== run.participants.length || run.participants.some(player => !ids.has(player.accountId))) throw new Error('RULE:参与资格不一致');
  const personal = data.result.players.map(player => ({ runId: data.runId, round: data.result.round, accountId: player.id, success: data.result.success, survivalSeconds: player.survivalSeconds ?? 0, kills: player.kills, assists: player.assists ?? 0, damage: player.damage }));
  await database.$transaction(async tx => {
    await tx.personalRoundRecord.createMany({ data: personal, skipDuplicates: true });
    await tx.roundRecord.create({ data: { runId: data.runId, round: data.result.round, success: data.result.success, results: data.result.players } });
  }); return { ok: true };
});
app.post('/internal/finish', async request => {
  internal(request.headers['x-internal-secret']); const data = finishSchema.parse(request.body);
  await database.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Run" WHERE "id" = ${data.runId} FOR UPDATE`;
    const run = await tx.run.findUniqueOrThrow({ where: { id: data.runId }, include: { participants: true, rounds: { orderBy: { round: 'asc' } } } });
    if (run.status === 'completed' || run.status === 'failed') return;
    const last = run.rounds.at(-1); if (run.status !== 'active') throw new Error('RULE:场次已中断');
    if (!last || ((run.contentVersion.startsWith('2.') || run.contentVersion.startsWith('3.')) ? last.success : last.success && last.round !== 2)) throw new Error('RULE:秘境尚未结束');
    const completed = run.rounds.filter(round => round.success).length;
    for (const player of run.participants) {
      if (player.settled) continue;
      let kills = 0; let assists = 0; let score = 0; for (const round of run.rounds) { const result = roundResultSchema.parse({ round: round.round, success: round.success, players: round.results }); const personal = result.players.find(item => item.id === player.accountId); kills += personal?.kills ?? 0; assists += personal?.assists ?? 0; const seconds = personal?.survivalSeconds ?? 0; score += survivalScore(seconds); }
      const assistCoins = run.contentVersion.startsWith('2.') || run.contentVersion.startsWith('3.') ? Math.floor(assists / 20) : 0;
      const cappedKills = Math.min(100, kills); const survivalCoins = Math.floor(score / 12); const killCoins = Math.floor(cappedKills / 10); const legacyKillCoins = Math.floor(cappedKills / 5); const coins = run.contentVersion === '1.0.0' ? completed * 30 + legacyKillCoins : survivalCoins + completed * 10 + killCoins + assistCoins; const materials = run.contentVersion.startsWith('2.') || run.contentVersion.startsWith('3.') ? 0 : completed;
      await tx.assetLedger.create({ data: { runId: run.id, accountId: player.accountId, coins, materials } });
      await tx.account.update({ where: { id: player.accountId }, data: { coins: { increment: coins }, materials: { increment: materials } } });
      await tx.participant.update({ where: { runId_accountId: { runId: run.id, accountId: player.accountId } }, data: { settled: true, coins, materials } });
    }
    const finalRaw = { round: last.round, success: last.success, players: last.results };
    const finalResult = roundResultSchema.parse(finalRaw);
    const insured = { runId: run.id, result: finalResult };
    await settleInsuredLoot(tx, insured, catalog);
    const status = last.success ? 'completed' : 'failed'; await tx.run.update({ where: { id: run.id }, data: { status } });
  });
  const participants = await database.participant.findMany({ where: { runId: data.runId }, select: { accountId: true, coins: true, materials: true } });
  const rewards = participants.map(player => ({ id: player.accountId, coins: player.coins, materials: player.materials }));
  return { ok: true, rewards };
});
app.post('/internal/interrupt', async request => { internal(request.headers['x-internal-secret']); const data = finishSchema.parse(request.body); await database.run.updateMany({ where: { id: data.runId, status: 'active' }, data: { status: 'interrupted' } }); return { ok: true }; });
app.post('/internal/recover', async request => { internal(request.headers['x-internal-secret']); const fields = { ruleVersion: z.literal('1') }; const schema = z.object(fields).strict(); schema.parse(request.body); await database.run.updateMany({ where: { status: 'active' }, data: { status: 'interrupted' } }); return { ok: true }; });
const port = Number(process.env.PORT ?? 3101);
await app.listen({ port, host: '0.0.0.0' });
async function shutdown(): Promise<void> { await app.close(); await database.$disconnect(); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
