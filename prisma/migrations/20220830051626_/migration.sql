/*
  Warnings:

  - A unique constraint covering the columns `[userId,poolGameId,teamBetId]` on the table `PoolGamePick` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PoolGamePick_userId_poolGameId_key";

-- CreateIndex
CREATE UNIQUE INDEX "PoolGamePick_userId_poolGameId_teamBetId_key" ON "PoolGamePick"("userId", "poolGameId", "teamBetId");
