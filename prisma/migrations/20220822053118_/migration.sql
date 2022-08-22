/*
  Warnings:

  - A unique constraint covering the columns `[sleeperId]` on the table `NFLTeam` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "NFLTeam_sleeperId_key" ON "NFLTeam"("sleeperId");
