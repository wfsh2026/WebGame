import type { Account, Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { difficultyAccessSchema, expeditionAccessSchema, expeditionSettlementSchema, hellEntrySchema, roundResultSchema } from '@web-game-world/contracts';
import type { ExpeditionDifficultyData, PersonalReward } from '@web-game-world/contracts';
import type { EquipmentItem } from '@web-game-world/simulation';
import { starterLoadout } from './starter-equipment';
import { settleInsuredLoot } from './insured-loot';

interface ExpeditionServices {
  database: PrismaClient;
  authenticate: (header: string | undefined) => Promise<Account>;
  internal: (header: string | string[] | undefined) => void;
  catalog: EquipmentItem[];
}

export async function expeditionAccess(database: Prisma.TransactionClient | PrismaClient, accountId: string): Promise<ExpeditionDifficultyData[]> {
  const records = await database.participant.findMany({ where: { accountId, baseCleared: true }, select: { run: { select: { difficulty: true } } } });
  const unlocked: ExpeditionDifficultyData[] = ['normal'];
  if (records.some(record => record.run.difficulty === 'normal')) unlocked.push('hard');
  if (records.some(record => record.run.difficulty === 'hard')) unlocked.push('nightmare');
  return unlocked;
}

export function registerExpedition(app: FastifyInstance, services: ExpeditionServices): void {
  const { database, authenticate, internal, catalog } = services;
  app.get('/api/expedition-access', async request => {
    const account = await authenticate(request.headers.authorization);
    const unlocked = await expeditionAccess(database, account.id);
    const response = { unlocked }; return expeditionAccessSchema.parse(response);
  });
  app.post('/internal/difficulty-access', async request => {
    internal(request.headers['x-internal-secret']); const data = difficultyAccessSchema.parse(request.body);
    for (const accountId of data.accountIds) {
      const unlocked = await expeditionAccess(database, accountId);
      if (!unlocked.includes(data.difficulty)) throw new Error('RULE:队伍中有玩家尚未解锁该难度');
    }
    return { ok: true };
  });
  app.post('/internal/hell-entry', async request => {
    internal(request.headers['x-internal-secret']); const data = hellEntrySchema.parse(request.body);
    return database.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Run" WHERE "id" = ${data.runId} FOR UPDATE`;
      const run = await tx.run.findUniqueOrThrow({ where: { id: data.runId } });
      const key = { runId: data.runId, accountId: data.accountId };
      const player = await tx.participant.findUniqueOrThrow({ where: { runId_accountId: key } });
      const latest = await tx.roundRecord.findFirst({ where: { runId: data.runId }, orderBy: { round: 'desc' } });
      if (run.status !== 'active' || player.settled || !player.baseCleared || latest?.round !== 20 || !latest.success) throw new Error('RULE:当前无法进入地狱挑战');
      if (!player.hellEntered) await tx.participant.update({ where: { runId_accountId: key }, data: { hellEntered: true } });
      return { ok: true };
    });
  });
  app.post('/internal/expedition-settle', async request => {
    internal(request.headers['x-internal-secret']); const data = expeditionSettlementSchema.parse(request.body);
    return database.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Run" WHERE "id" = ${data.runId} FOR UPDATE`;
      const run = await tx.run.findUniqueOrThrow({ where: { id: data.runId }, include: { participants: true } });
      const ids = [...new Set(data.accountIds)]; ids.sort();
      if (ids.length !== data.accountIds.length || ids.some(id => !run.participants.some(player => player.accountId === id))) throw new Error('RULE:结算玩家资格不一致');
      const unsettled = run.participants.filter(player => ids.includes(player.accountId) && !player.settled);
      if (unsettled.length) {
        if (run.status !== 'active' || run.contentVersion !== '5.0.0') throw new Error('RULE:当前场次无法结算');
        const latest = await tx.roundRecord.findFirst({ where: { runId: run.id }, orderBy: { round: 'desc' } });
        if (!latest || latest.round !== data.round) throw new Error('RULE:当前关卡成果尚未保存');
        if (data.outcome === 'failed' ? latest.success : !latest.success || latest.round < 20) throw new Error('RULE:结算结果与关卡成果不一致');
        if (data.outcome === 'hell-victory' && latest.round !== 40 || data.outcome === 'extracted' && latest.round >= 40) throw new Error('RULE:地狱结算层数不正确');
        const rawResult = { round: latest.round, success: latest.success, players: latest.results };
        const result = roundResultSchema.parse(rawResult);
        for (const accountId of ids) {
          const participant = unsettled.find(player => player.accountId === accountId); if (!participant) continue;
          const personal = result.players.find(player => player.id === accountId);
          if (!personal) throw new Error('RULE:缺少个人关卡成果');
          await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${accountId} FOR UPDATE`;
          const account = await tx.account.findUniqueOrThrow({ where: { id: accountId } });
          if (account.activeRunId !== run.id) throw new Error('RULE:玩家活动场次不一致');
          const earned = Math.max(participant.earned, personal.coinsEarned ?? 0);
          const pending = Math.max(0, earned - participant.spent);
          const lost = data.outcome === 'failed' && participant.hellEntered;
          const coins = lost ? 0 : pending;
          const entry = { runId: run.id, accountId, coins, materials: 0 };
          await tx.assetLedger.create({ data: entry });
          if (!lost) {
            const rewardResult = { ...result, players: [personal] }; const lootData = { runId: run.id, result: rewardResult };
            await settleInsuredLoot(tx, lootData, catalog);
          }
          const loadout = starterLoadout(account.characterLevel);
          const accountChanges = { coins: { increment: coins }, activeRunId: null, loadout, loadoutRevision: { increment: 1 } };
          await tx.account.update({ where: { id: accountId }, data: accountChanges });
          const changes = { settled: true, coins, materials: 0, earned, outcome: data.outcome };
          const key = { runId: run.id, accountId };
          await tx.participant.update({ where: { runId_accountId: key }, data: changes });
        }
      }
      const participants = await tx.participant.findMany({ where: { runId: run.id } });
      if (participants.every(player => player.settled)) {
        const status = participants.some(player => player.baseCleared) ? 'completed' : 'failed';
        await tx.run.update({ where: { id: run.id }, data: { status } });
      }
      const rewards: PersonalReward[] = [];
      for (const player of participants) {
        if (!player.settled) continue;
        const outcome = player.outcome === 'hell-victory' ? 'hell-victory' : player.outcome === 'extracted' ? 'extracted' : 'failed';
        const lost = outcome === 'failed' && player.hellEntered ? Math.max(0, player.earned - player.spent) : 0;
        rewards.push({ id: player.accountId, coins: player.coins, materials: player.materials, earned: player.earned, spent: player.spent, outcome, baseCleared: player.baseCleared, hellFloor: player.hellFloor, lost });
      }
      return { rewards };
    });
  });
}
