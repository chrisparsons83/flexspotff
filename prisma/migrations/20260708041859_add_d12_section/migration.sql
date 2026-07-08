-- CreateTable
CREATE TABLE "D12Season" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "D12Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "D12League" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "sleeperLeagueId" TEXT NOT NULL,
    "d12SeasonId" TEXT NOT NULL,

    CONSTRAINT "D12League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "D12WeekScore" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "week" INTEGER NOT NULL,
    "points" DOUBLE PRECISION,
    "d12LeagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "D12WeekScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "D12DraftPick" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sleeperId" TEXT NOT NULL,
    "pickNo" INTEGER NOT NULL,
    "d12LeagueId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "D12DraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "D12Season_year_key" ON "D12Season"("year");

-- CreateIndex
CREATE UNIQUE INDEX "D12League_sleeperLeagueId_key" ON "D12League"("sleeperLeagueId");

-- CreateIndex
CREATE INDEX "D12League_d12SeasonId_idx" ON "D12League"("d12SeasonId");

-- CreateIndex
CREATE INDEX "D12WeekScore_d12LeagueId_week_idx" ON "D12WeekScore"("d12LeagueId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "D12WeekScore_d12LeagueId_userId_week_key" ON "D12WeekScore"("d12LeagueId", "userId", "week");

-- CreateIndex
CREATE INDEX "D12DraftPick_d12LeagueId_idx" ON "D12DraftPick"("d12LeagueId");

-- CreateIndex
CREATE UNIQUE INDEX "D12DraftPick_d12LeagueId_sleeperId_key" ON "D12DraftPick"("d12LeagueId", "sleeperId");

-- AddForeignKey
ALTER TABLE "D12League" ADD CONSTRAINT "D12League_d12SeasonId_fkey" FOREIGN KEY ("d12SeasonId") REFERENCES "D12Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "D12WeekScore" ADD CONSTRAINT "D12WeekScore_d12LeagueId_fkey" FOREIGN KEY ("d12LeagueId") REFERENCES "D12League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "D12WeekScore" ADD CONSTRAINT "D12WeekScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "D12DraftPick" ADD CONSTRAINT "D12DraftPick_d12LeagueId_fkey" FOREIGN KEY ("d12LeagueId") REFERENCES "D12League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "D12DraftPick" ADD CONSTRAINT "D12DraftPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

