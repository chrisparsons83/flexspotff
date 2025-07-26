/*
  Warnings:

  - A unique constraint covering the columns `[userId,year,week,position]` on the table `DFSSurvivorUserEntry` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `position` to the `DFSSurvivorUserEntry` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "DFSSurvivorUserEntry_userId_year_week_nflGameId_playerId_key";

-- AlterTable
ALTER TABLE "DFSSurvivorUserEntry" ADD COLUMN     "position" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DFSSurvivorUserEntry_userId_year_week_position_key" ON "DFSSurvivorUserEntry"("userId", "year", "week", "position");
