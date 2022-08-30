-- AlterTable
ALTER TABLE "PoolGamePick" ALTER COLUMN "resultWonLoss" DROP NOT NULL,
ALTER COLUMN "resultWonLoss" SET DEFAULT 0;
