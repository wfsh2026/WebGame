CREATE TABLE "PersonalRoundRecord" (
    "runId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "survivalSeconds" DOUBLE PRECISION NOT NULL,
    "kills" INTEGER NOT NULL,
    "damage" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "PersonalRoundRecord_pkey" PRIMARY KEY ("runId", "round", "accountId"),
    CONSTRAINT "PersonalRoundRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
