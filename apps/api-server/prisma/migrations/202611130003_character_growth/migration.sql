ALTER TABLE "Account"
ADD COLUMN "characterGrowth" JSONB NOT NULL DEFAULT '{"power":0,"magic":0,"vitality":0,"spirit":0,"movement":0,"haste":0,"luck":0}',
ADD COLUMN "characterGrowthRevision" INTEGER NOT NULL DEFAULT 0;
