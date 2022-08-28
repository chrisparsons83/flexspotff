/*
  Warnings:

  - A unique constraint covering the columns `[userId,poolGameId]` on the table `PoolGamePick` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[year,weekNumber]` on the table `PoolWeek` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "PoolGamePick_userId_poolGameId_key" ON "PoolGamePick"("userId", "poolGameId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolWeek_year_weekNumber_key" ON "PoolWeek"("year", "weekNumber");
