/*
  Warnings:

  - You are about to drop the column `uniqueId` on the `QBStreamingWeekOption` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[qbStreamingWeekId,playerId]` on the table `QBStreamingWeekOption` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "QBStreamingWeekOption_uniqueId_key";

-- AlterTable
ALTER TABLE "QBStreamingWeekOption" DROP COLUMN "uniqueId";

-- CreateIndex
CREATE UNIQUE INDEX "QBStreamingWeekOption_qbStreamingWeekId_playerId_key" ON "QBStreamingWeekOption"("qbStreamingWeekId", "playerId");
