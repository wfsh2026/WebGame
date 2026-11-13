CREATE TABLE "TestAssetAdjustment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "coinsBefore" INTEGER NOT NULL,
    "coinsAfter" INTEGER NOT NULL,
    "materialsBefore" INTEGER NOT NULL,
    "materialsAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestAssetAdjustment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TestAssetAdjustment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TestAssetAdjustment_accountId_createdAt_idx" ON "TestAssetAdjustment"("accountId", "createdAt");
