import type { Account, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { inventoryStateSchema } from '@web-game-world/contracts';

interface InventoryServices {
  database: PrismaClient;
  authenticate: (header: string | undefined) => Promise<Account>;
}

// 实物库存与 AccountItem 的技能解锁记录分开，背包读取不会改变技能搭配。
export function registerInventory(app: FastifyInstance, services: InventoryServices): void {
  app.get('/api/inventory', async request => {
    const account = await services.authenticate(request.headers.authorization);
    if (!account.role) throw new Error('RULE:请先创建角色');
    const entries = await services.database.inventoryEntry.findMany({ where: { accountId: account.id, quantity: { gt: 0 } }, include: { definition: true }, orderBy: { acquiredAt: 'desc' } });
    const items = entries.map(entry => {
      const acquiredAt = entry.acquiredAt.toISOString();
      const { name, category, effect } = entry.definition;
      return { level: entry.level, definitionId: entry.definitionId, id: entry.id, name, category, effect, quantity: entry.quantity, acquiredAt };
    });
    return inventoryStateSchema.parse(items);
  });
}
