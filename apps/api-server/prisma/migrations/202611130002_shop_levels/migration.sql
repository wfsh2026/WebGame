BEGIN;
ALTER TABLE "Account" ADD COLUMN "shopOffers" JSONB, ADD COLUMN "shopRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AccountItem" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ShopPurchase" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "shelfRevision" INTEGER NOT NULL DEFAULT -1;
DROP INDEX "ShopPurchase_accountId_itemId_key";
CREATE INDEX "ShopPurchase_accountId_itemId_idx" ON "ShopPurchase"("accountId", "itemId");

CREATE TABLE "ShopRefresh" (
  "accountId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "sourceRevision" INTEGER NOT NULL,
  "coins" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopRefresh_pkey" PRIMARY KEY ("accountId", "requestId"),
  CONSTRAINT "ShopRefresh_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "CharacterFunding" (
  "accountId" TEXT NOT NULL,
  "coins" INTEGER NOT NULL,
  "materials" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterFunding_pkey" PRIMARY KEY ("accountId"),
  CONSTRAINT "CharacterFunding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 将旧角色隐式拥有的初始构筑落库，保留其现有物品。
INSERT INTO "AccountItem" ("accountId", "itemId", "level", "createdAt")
SELECT account."id", starter."itemId", 1, CURRENT_TIMESTAMP
FROM "Account" account CROSS JOIN (VALUES
  ('forest-survival:heart/stream'), ('forest-survival:weapon/longblade'),
  ('forest-survival:support/economy'), ('forest-survival:skill/fireball')
) starter("itemId")
WHERE account."role" IS NOT NULL
ON CONFLICT ("accountId", "itemId") DO NOTHING;

-- 已带出的有等级物品沿用其最高基础等级。
UPDATE "AccountItem" owned SET "level" = GREATEST(owned."level", loot."level")
FROM (SELECT "accountId", "definitionId", MAX("level") AS "level" FROM "InventoryEntry" WHERE "quantity" > 0 GROUP BY "accountId", "definitionId") loot
WHERE owned."accountId" = loot."accountId" AND owned."itemId" = loot."definitionId";
COMMIT;
