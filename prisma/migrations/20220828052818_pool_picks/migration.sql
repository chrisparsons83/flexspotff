/*
  Warnings:

  - Added the required column `isOpen` to the `PoolWeek` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `PoolWeek` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PoolWeek" ADD COLUMN     "isOpen" BOOLEAN NOT NULL,
ADD COLUMN     "year" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "PoolGame" (
    "id" TEXT NOT NULL,
    "homeSpread" DOUBLE PRECISION NOT NULL,
    "gameId" TEXT NOT NULL,

    CONSTRAINT "PoolGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolGamePick" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "amountBet" INTEGER NOT NULL,
    "teamBetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolGameId" TEXT NOT NULL,

    CONSTRAINT "PoolGamePick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PoolGame_gameId_key" ON "PoolGame"("gameId");

-- AddForeignKey
ALTER TABLE "PoolGame" ADD CONSTRAINT "PoolGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "NFLGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolGamePick" ADD CONSTRAINT "PoolGamePick_teamBetId_fkey" FOREIGN KEY ("teamBetId") REFERENCES "NFLTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolGamePick" ADD CONSTRAINT "PoolGamePick_poolGameId_fkey" FOREIGN KEY ("poolGameId") REFERENCES "PoolGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolGamePick" ADD CONSTRAINT "PoolGamePick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
