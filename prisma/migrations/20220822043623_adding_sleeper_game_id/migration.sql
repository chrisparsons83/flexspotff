/*
  Warnings:

  - A unique constraint covering the columns `[sleeperGameId]` on the table `NFLGame` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sleeperGameId` to the `NFLGame` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "NFLGame" ADD COLUMN     "sleeperGameId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "NFLGame_sleeperGameId_key" ON "NFLGame"("sleeperGameId");
