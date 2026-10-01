-- CreateTable
CREATE TABLE "BestBallSeason" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "BestBallSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BestBallLeague" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "sleeperLeagueId" TEXT NOT NULL,
    "sleeperDraftId" TEXT,
    "teamCount" INTEGER NOT NULL,
    "lastScoredWeek" INTEGER NOT NULL DEFAULT 0,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "bestBallSeasonId" TEXT NOT NULL,

    CONSTRAINT "BestBallLeague_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BestBallTeam" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rosterId" INTEGER NOT NULL,
    "sleeperOwnerId" TEXT,
    "sleeperDisplayName" TEXT,
    "userId" TEXT,
    "draftSlot" INTEGER,
    "pointsFor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finish" INTEGER,
    "bestBallLeagueId" TEXT NOT NULL,

    CONSTRAINT "BestBallTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BestBallWeekScore" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "week" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "starters" TEXT[],
    "startingPlayerPoints" DOUBLE PRECISION[],
    "bestBallTeamId" TEXT NOT NULL,

    CONSTRAINT "BestBallWeekScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BestBallDraftPick" (
    "id" TEXT NOT NULL,
    "pickNo" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "draftSlot" INTEGER NOT NULL,
    "rosterId" INTEGER NOT NULL,
    "sleeperId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "nflTeam" TEXT,
    "bestBallLeagueId" TEXT NOT NULL,

    CONSTRAINT "BestBallDraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BestBallSeason_year_key" ON "BestBallSeason"("year");

-- CreateIndex
CREATE UNIQUE INDEX "BestBallLeague_sleeperLeagueId_key" ON "BestBallLeague"("sleeperLeagueId");

-- CreateIndex
CREATE UNIQUE INDEX "BestBallLeague_bestBallSeasonId_key" ON "BestBallLeague"("bestBallSeasonId");

-- CreateIndex
CREATE INDEX "BestBallTeam_userId_idx" ON "BestBallTeam"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BestBallTeam_bestBallLeagueId_rosterId_key" ON "BestBallTeam"("bestBallLeagueId", "rosterId");

-- CreateIndex
CREATE UNIQUE INDEX "BestBallWeekScore_bestBallTeamId_week_key" ON "BestBallWeekScore"("bestBallTeamId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "BestBallDraftPick_bestBallLeagueId_pickNo_key" ON "BestBallDraftPick"("bestBallLeagueId", "pickNo");

-- AddForeignKey
ALTER TABLE "BestBallLeague" ADD CONSTRAINT "BestBallLeague_bestBallSeasonId_fkey" FOREIGN KEY ("bestBallSeasonId") REFERENCES "BestBallSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestBallTeam" ADD CONSTRAINT "BestBallTeam_bestBallLeagueId_fkey" FOREIGN KEY ("bestBallLeagueId") REFERENCES "BestBallLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestBallTeam" ADD CONSTRAINT "BestBallTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestBallWeekScore" ADD CONSTRAINT "BestBallWeekScore_bestBallTeamId_fkey" FOREIGN KEY ("bestBallTeamId") REFERENCES "BestBallTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestBallDraftPick" ADD CONSTRAINT "BestBallDraftPick_bestBallLeagueId_fkey" FOREIGN KEY ("bestBallLeagueId") REFERENCES "BestBallLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

