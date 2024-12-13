-- CreateTable
CREATE TABLE "DfsSurvivorWeek" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL,
    "isScored" BOOLEAN NOT NULL,

    CONSTRAINT "DfsSurvivorWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DfsSurvivorEntry" (
    "id" TEXT NOT NULL,
    "pointsScored" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nflGameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "dfsSurvivorWeekId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "DfsSurvivorEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DfsSurvivorEntry_userId_playerId_year_key" ON "DfsSurvivorEntry"("userId", "playerId", "year");

-- AddForeignKey
ALTER TABLE "DfsSurvivorEntry" ADD CONSTRAINT "DfsSurvivorEntry_dfsSurvivorWeekId_fkey" FOREIGN KEY ("dfsSurvivorWeekId") REFERENCES "DfsSurvivorWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DfsSurvivorEntry" ADD CONSTRAINT "DfsSurvivorEntry_nflGameId_fkey" FOREIGN KEY ("nflGameId") REFERENCES "NFLGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DfsSurvivorEntry" ADD CONSTRAINT "DfsSurvivorEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DfsSurvivorEntry" ADD CONSTRAINT "DfsSurvivorEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
