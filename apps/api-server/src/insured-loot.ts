import type { Prisma } from '@prisma/client';
import type { EquipmentItem } from '@web-game-world/simulation';
import type { RoundResult } from '@web-game-world/contracts';

export async function settleInsuredLoot(tx: Prisma.TransactionClient, data: { runId: string; result: RoundResult }, catalog: EquipmentItem[]): Promise<void> {
  const seen = new Set<string>();
  for (const player of data.result.players) {
    for (const loot of player.safe ?? []) {
      if (loot.category !== 'insured' || seen.has(loot.id) || loot.wave > data.result.round) throw new Error('RULE:保险箱来源无效');
      seen.add(loot.id);
      const item = catalog.find(entry => entry.id === loot.definitionId);
      if (!item || loot.level > 20) throw new Error('RULE:保险箱物品无效');
      const category = item.kind === 'skill' || item.kind === 'support' ? 'skill' : 'equipment';
      const effect = (item.description ?? item.name).slice(0, 96);
      const definition = { id: item.id, name: item.name, category, effect };
      await tx.inventoryDefinition.upsert({ where: { id: item.id }, create: definition, update: { name: item.name, category, effect } });
      const entry = { accountId: player.id, definitionId: item.id, level: loot.level, quantity: 1, sourceRunId: data.runId, sourceLootId: loot.id };
      await tx.inventoryEntry.create({ data: entry });
      const key = { accountId: player.id, itemId: item.id };
      await tx.accountItem.upsert({ where: { accountId_itemId: key }, create: { ...key, level: loot.level }, update: {} });
      await tx.accountItem.updateMany({ where: { ...key, level: { lt: loot.level } }, data: { level: loot.level } });
      await tx.account.update({ where: { id: player.id }, data: { loadoutRevision: { increment: 1 } } });
    }
  }
}
