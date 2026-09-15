-- CreateTable
CREATE TABLE "WaiverTransaction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leagueId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "sleeperLeg" INTEGER NOT NULL,
    "sleeperTransactionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "bid" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "notes" TEXT,
    "rosterId" INTEGER NOT NULL,
    "sleeperOwnerId" TEXT NOT NULL,
    "userId" TEXT,
    "addSleeperId" TEXT NOT NULL,
    "addPlayerId" TEXT,
    "dropPlayerId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaiverTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaiverReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leagueId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discordMessageId" TEXT,

    CONSTRAINT "WaiverReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaiverTransaction_leagueId_week_idx" ON "WaiverTransaction"("leagueId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "WaiverTransaction_leagueId_sleeperTransactionId_key" ON "WaiverTransaction"("leagueId", "sleeperTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "WaiverReport_leagueId_week_key" ON "WaiverReport"("leagueId", "week");

-- AddForeignKey
ALTER TABLE "WaiverTransaction" ADD CONSTRAINT "WaiverTransaction_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverTransaction" ADD CONSTRAINT "WaiverTransaction_addPlayerId_fkey" FOREIGN KEY ("addPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverTransaction" ADD CONSTRAINT "WaiverTransaction_dropPlayerId_fkey" FOREIGN KEY ("dropPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverTransaction" ADD CONSTRAINT "WaiverTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverReport" ADD CONSTRAINT "WaiverReport_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
