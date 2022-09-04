/*
  Warnings:

  - Added the required column `nflGameId` to the `QBStreamingWeekOption` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "QBStreamingWeekOption" ADD COLUMN     "nflGameId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "QBStreamingWeekOption" ADD CONSTRAINT "QBStreamingWeekOption_nflGameId_fkey" FOREIGN KEY ("nflGameId") REFERENCES "NFLGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
