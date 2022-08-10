/*
  Warnings:

  - A unique constraint covering the columns `[sleeperLeagueId]` on the table `League` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sleeperDraftId]` on the table `League` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "League_sleeperLeagueId_key" ON "League"("sleeperLeagueId");

-- CreateIndex
CREATE UNIQUE INDEX "League_sleeperDraftId_key" ON "League"("sleeperDraftId");
