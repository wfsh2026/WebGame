CREATE TABLE "AccountItem" (
    "accountId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountItem_pkey" PRIMARY KEY ("accountId", "itemId"),
    CONSTRAINT "AccountItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ShopPurchase" (
    "accountId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "materials" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopPurchase_pkey" PRIMARY KEY ("accountId", "requestId"),
    CONSTRAINT "ShopPurchase_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShopPurchase_accountId_itemId_key" ON "ShopPurchase"("accountId", "itemId");
