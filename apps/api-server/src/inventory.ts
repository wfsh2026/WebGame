import { canonicalEquipmentId } from '@web-game-world/simulation';
import type { EquipmentItem } from '@web-game-world/simulation';
import type { Account, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { inventoryStateSchema } from '@web-game-world/contracts';

interface InventoryServices {
  database: PrismaClient;
  catalog: EquipmentItem[];
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
      const definitionId = canonicalEquipmentId(entry.definitionId);
      const current = services.catalog.find(item => item.id === definitionId);
      const name = current?.name ?? entry.definition.name;
      const category = current?.kind === 'skill' || current?.kind === 'support' ? 'skill' : entry.definition.category;
      const effect = current?.description ?? entry.definition.effect;
      const description = effect.slice(0, 96);
      return { level: entry.level, definitionId, skillType: current?.skillType, id: entry.id, name, category, effect: description, quantity: entry.quantity, acquiredAt };
    });
    return inventoryStateSchema.parse(items);
  });
}
