-- AlterTable
ALTER TABLE "PoolWeekMissed" ADD COLUMN     "isLoss" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isTie" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isWin" INTEGER NOT NULL DEFAULT 0;
