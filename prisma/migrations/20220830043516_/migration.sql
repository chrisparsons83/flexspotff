-- AlterTable
ALTER TABLE "PoolGame" ADD COLUMN     "poolWeekId" TEXT;

-- AddForeignKey
ALTER TABLE "PoolGame" ADD CONSTRAINT "PoolGame_poolWeekId_fkey" FOREIGN KEY ("poolWeekId") REFERENCES "PoolWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;
