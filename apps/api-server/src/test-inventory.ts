import type { PrismaClient } from '@prisma/client';

// 仅由测试工具调用；不注册为正式掉落，也不授予技能解锁。
const samples = [
  { id: 'test-inventory:skill/wind', name: '风行卷轴', category: 'skill', quantity: 2, effect: '移动速度 +10%（测试展示，暂不生效）' },
  { id: 'test-inventory:skill/frost', name: '冰霜卷轴', category: 'skill', quantity: 3, effect: '命中后减速 20%（测试展示，暂不生效）' },
  { id: 'test-inventory:equipment/bow', name: '林地猎弓', category: 'equipment', quantity: 1, effect: '物理攻击 +12（测试展示，暂不生效）' },
  { id: 'test-inventory:equipment/armor', name: '游侠皮甲', category: 'equipment', quantity: 1, effect: '物理防御 +8（测试展示，暂不生效）' },
  { id: 'test-inventory:equipment/dagger', name: '精铁短刃', category: 'equipment', quantity: 1, effect: '物理攻击 +6（测试展示，暂不生效）' },
  { id: 'test-inventory:material/herb', name: '青叶草', category: 'material', quantity: 12, effect: '药剂制作材料（测试展示，暂不可消耗）' },
  { id: 'test-inventory:material/ore', name: '铁矿石', category: 'material', quantity: 8, effect: '装备锻造材料（测试展示，暂不可消耗）' },
  { id: 'test-inventory:material/wood', name: '木材', category: 'material', quantity: 24, effect: '制作与经营材料（测试展示，暂不可消耗）' }
];

export async function grantTestInventory(database: PrismaClient, accountId: string, requestId: string) {
  return database.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Account" WHERE "id" = ${accountId} FOR UPDATE`;
    const key = { accountId, requestId };
    const previous = await tx.testInventoryGrant.findUnique({ where: { accountId_requestId: key } });
    if (previous) return { addedTypes: samples.length };
    for (const sample of samples) {
      const { quantity, ...definition } = sample;
      await tx.inventoryDefinition.upsert({ where: { id: sample.id }, create: definition, update: definition });
      const entry = { accountId, definitionId: sample.id, quantity };
      if (sample.category === 'equipment') await tx.inventoryEntry.create({ data: entry });
      else {
        const id = `${accountId}:${sample.id}`;
        const acquiredAt = new Date();
        await tx.inventoryEntry.upsert({ where: { id }, create: { ...entry, id }, update: { quantity: { increment: quantity }, acquiredAt } });
      }
    }
    await tx.testInventoryGrant.create({ data: key });
    return { addedTypes: samples.length };
  });
}
