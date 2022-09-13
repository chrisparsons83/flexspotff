/*
  Warnings:

  - A unique constraint covering the columns `[userId,poolWeekId]` on the table `PoolWeekMissed` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "PoolWeekMissed_userId_poolWeekId_key" ON "PoolWeekMissed"("userId", "poolWeekId");
