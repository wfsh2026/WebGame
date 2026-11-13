CREATE TABLE "InventoryDefinition" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(24) NOT NULL,
    "category" TEXT NOT NULL CHECK ("category" IN ('skill', 'equipment', 'material')),
    "effect" VARCHAR(96) NOT NULL,
    CONSTRAINT "InventoryDefinition_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "InventoryEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1 CHECK ("quantity" > 0),
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryEntry_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "InventoryDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "InventoryEntry_accountId_idx" ON "InventoryEntry"("accountId");
