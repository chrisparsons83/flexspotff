/*
  Warnings:

  - You are about to drop the `DfsSurvivorEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DfsSurvivorWeek` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DfsSurvivorYear` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DfsSurvivorEntry" DROP CONSTRAINT "DfsSurvivorEntry_dfsSurvivorWeekId_fkey";

-- DropForeignKey
ALTER TABLE "DfsSurvivorEntry" DROP CONSTRAINT "DfsSurvivorEntry_nflGameId_fkey";

-- DropForeignKey
ALTER TABLE "DfsSurvivorEntry" DROP CONSTRAINT "DfsSurvivorEntry_playerId_fkey";

-- DropForeignKey
ALTER TABLE "DfsSurvivorEntry" DROP CONSTRAINT "DfsSurvivorEntry_userId_fkey";

-- DropForeignKey
ALTER TABLE "DfsSurvivorWeek" DROP CONSTRAINT "DfsSurvivorWeek_dfsSurvivorYearId_fkey";

-- DropForeignKey
ALTER TABLE "DfsSurvivorYear" DROP CONSTRAINT "DfsSurvivorYear_userId_fkey";

-- DropTable
DROP TABLE "DfsSurvivorEntry";

-- DropTable
DROP TABLE "DfsSurvivorWeek";

-- DropTable
DROP TABLE "DfsSurvivorYear";

-- CreateTable
CREATE TABLE "DFSSurvivorServerYear" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DFSSurvivorServerYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DFSSurvivorUserYear" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DFSSurvivorUserYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DFSSurvivorUserWeek" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "isScored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DFSSurvivorUserWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DFSSurvivorUserEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "nflGameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DFSSurvivorUserEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DFSSurvivorServerYear_year_key" ON "DFSSurvivorServerYear"("year");

-- CreateIndex
CREATE UNIQUE INDEX "DFSSurvivorUserYear_userId_year_key" ON "DFSSurvivorUserYear"("userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "DFSSurvivorUserWeek_userId_year_week_key" ON "DFSSurvivorUserWeek"("userId", "year", "week");

-- CreateIndex
CREATE UNIQUE INDEX "DFSSurvivorUserEntry_userId_year_week_nflGameId_playerId_key" ON "DFSSurvivorUserEntry"("userId", "year", "week", "nflGameId", "playerId");

-- AddForeignKey
ALTER TABLE "DFSSurvivorUserYear" ADD CONSTRAINT "DFSSurvivorUserYear_year_fkey" FOREIGN KEY ("year") REFERENCES "DFSSurvivorServerYear"("year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DFSSurvivorUserYear" ADD CONSTRAINT "DFSSurvivorUserYear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DFSSurvivorUserWeek" ADD CONSTRAINT "DFSSurvivorUserWeek_userId_year_fkey" FOREIGN KEY ("userId", "year") REFERENCES "DFSSurvivorUserYear"("userId", "year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DFSSurvivorUserEntry" ADD CONSTRAINT "DFSSurvivorUserEntry_userId_year_week_fkey" FOREIGN KEY ("userId", "year", "week") REFERENCES "DFSSurvivorUserWeek"("userId", "year", "week") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DFSSurvivorUserEntry" ADD CONSTRAINT "DFSSurvivorUserEntry_nflGameId_fkey" FOREIGN KEY ("nflGameId") REFERENCES "NFLGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DFSSurvivorUserEntry" ADD CONSTRAINT "DFSSurvivorUserEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
