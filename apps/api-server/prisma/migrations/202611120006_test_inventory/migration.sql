CREATE TABLE "TestInventoryGrant" (
    "accountId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestInventoryGrant_pkey" PRIMARY KEY ("accountId", "requestId")
);
