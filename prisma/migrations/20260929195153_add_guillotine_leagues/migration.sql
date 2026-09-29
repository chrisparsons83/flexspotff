-- CreateEnum
CREATE TYPE "GuillotineFormat" AS ENUM ('NATIVE', 'MANUAL');

-- CreateTable
CREATE TABLE "GuillotineSeason" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "GuillotineSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuillotineLeague" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "sleeperLeagueId" TEXT NOT NULL,
    "sleeperDraftId" TEXT,
    "format" "GuillotineFormat" NOT NULL,
    "teamCount" INTEGER NOT NULL,
    "scoringSettings" JSONB,
    "lastScoredWeek" INTEGER NOT NULL DEFAULT 0,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "guillotineSeasonId" TEXT NOT NULL,

    CONSTRAINT "GuillotineLeague_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuillotineTeam" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rosterId" INTEGER NOT NULL,
    "sleeperOwnerId" TEXT,
    "sleeperDisplayName" TEXT,
    "userId" TEXT,
    "draftSlot" INTEGER,
    "choppedWeek" INTEGER,
    "finish" INTEGER,
    "waiverBudgetUsed" INTEGER NOT NULL DEFAULT 0,
    "guillotineLeagueId" TEXT NOT NULL,

    CONSTRAINT "GuillotineTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuillotineWeekScore" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "week" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "starters" TEXT[],
    "startingPlayerPoints" DOUBLE PRECISION[],
    "players" TEXT[],
    "guillotineTeamId" TEXT NOT NULL,

    CONSTRAINT "GuillotineWeekScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuillotineTransaction" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sleeperTransactionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "leg" INTEGER NOT NULL,
    "rosterIds" INTEGER[],
    "adds" JSONB,
    "drops" JSONB,
    "bid" INTEGER,
    "seq" INTEGER,
    "notes" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL,
    "guillotineLeagueId" TEXT NOT NULL,

    CONSTRAINT "GuillotineTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuillotineDraftPick" (
    "id" TEXT NOT NULL,
    "pickNo" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "rosterId" INTEGER NOT NULL,
    "sleeperId" TEXT NOT NULL,
    "guillotineLeagueId" TEXT NOT NULL,

    CONSTRAINT "GuillotineDraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuillotineSeason_year_key" ON "GuillotineSeason"("year");

-- CreateIndex
CREATE UNIQUE INDEX "GuillotineLeague_sleeperLeagueId_key" ON "GuillotineLeague"("sleeperLeagueId");

-- CreateIndex
CREATE INDEX "GuillotineLeague_guillotineSeasonId_idx" ON "GuillotineLeague"("guillotineSeasonId");

-- CreateIndex
CREATE INDEX "GuillotineTeam_userId_idx" ON "GuillotineTeam"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GuillotineTeam_guillotineLeagueId_rosterId_key" ON "GuillotineTeam"("guillotineLeagueId", "rosterId");

-- CreateIndex
CREATE UNIQUE INDEX "GuillotineWeekScore_guillotineTeamId_week_key" ON "GuillotineWeekScore"("guillotineTeamId", "week");

-- CreateIndex
CREATE INDEX "GuillotineTransaction_guillotineLeagueId_leg_idx" ON "GuillotineTransaction"("guillotineLeagueId", "leg");

-- CreateIndex
CREATE UNIQUE INDEX "GuillotineTransaction_guillotineLeagueId_sleeperTransaction_key" ON "GuillotineTransaction"("guillotineLeagueId", "sleeperTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "GuillotineDraftPick_guillotineLeagueId_pickNo_key" ON "GuillotineDraftPick"("guillotineLeagueId", "pickNo");

-- AddForeignKey
ALTER TABLE "GuillotineLeague" ADD CONSTRAINT "GuillotineLeague_guillotineSeasonId_fkey" FOREIGN KEY ("guillotineSeasonId") REFERENCES "GuillotineSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuillotineTeam" ADD CONSTRAINT "GuillotineTeam_guillotineLeagueId_fkey" FOREIGN KEY ("guillotineLeagueId") REFERENCES "GuillotineLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuillotineTeam" ADD CONSTRAINT "GuillotineTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuillotineWeekScore" ADD CONSTRAINT "GuillotineWeekScore_guillotineTeamId_fkey" FOREIGN KEY ("guillotineTeamId") REFERENCES "GuillotineTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuillotineTransaction" ADD CONSTRAINT "GuillotineTransaction_guillotineLeagueId_fkey" FOREIGN KEY ("guillotineLeagueId") REFERENCES "GuillotineLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuillotineDraftPick" ADD CONSTRAINT "GuillotineDraftPick_guillotineLeagueId_fkey" FOREIGN KEY ("guillotineLeagueId") REFERENCES "GuillotineLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;
