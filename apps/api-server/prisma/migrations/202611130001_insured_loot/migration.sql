ALTER TABLE "InventoryEntry" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "sourceRunId" TEXT, ADD COLUMN "sourceLootId" TEXT;
CREATE UNIQUE INDEX "InventoryEntry_sourceRunId_sourceLootId_key" ON "InventoryEntry"("sourceRunId", "sourceLootId");
