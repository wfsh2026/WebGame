import type { Account, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { testAssetAdjustmentSchema } from '@web-game-world/contracts';
import { testInventoryGrantSchema } from '@web-game-world/contracts';
import { grantTestInventory } from './test-inventory';

interface TestToolsServices {
  database: PrismaClient;
  authenticate: (header: string | undefined) => Promise<Account>;
}

export function registerTestTools(app: FastifyInstance, services: TestToolsServices): void {
  if (process.env.ENABLE_TEST_TOOLS !== '1' || process.env.APP_ENV !== 'test') return;
  const { database, authenticate } = services;

  app.post('/api/test-tools/inventory', async request => {
    const account = await authenticate(request.headers.authorization);
    if (!account.role) throw new Error('RULE:请先创建角色');
    const data = testInventoryGrantSchema.parse(request.body);
    return grantTestInventory(database, account.id, data.requestId);
  });

  app.get('/api/test-tools/assets', async request => {
    const account = await authenticate(request.headers.authorization);
    return { coins: account.coins, materials: account.materials };
  });

  app.post('/api/test-tools/assets', async request => {
    const account = await authenticate(request.headers.authorization);
    const data = testAssetAdjustmentSchema.parse(request.body);
    return database.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${account.id} FOR UPDATE`;
      const current = await tx.account.findUniqueOrThrow({ where: { id: account.id }, select: { coins: true, materials: true } });
      if (current.coins === data.coins && current.materials === data.materials) return current;
      if (current.coins !== data.expected.coins || current.materials !== data.expected.materials) throw new Error('RULE:余额已发生变化，请刷新工具面板后重新调整');
      const balances = { coins: data.coins, materials: data.materials };
      const receipt = { accountId: account.id, coinsBefore: current.coins, coinsAfter: data.coins, materialsBefore: current.materials, materialsAfter: data.materials };
      await tx.account.update({ where: { id: account.id }, data: balances });
      await tx.testAssetAdjustment.create({ data: receipt });
      return balances;
    });
  });
}
