-- CreateEnum
CREATE TYPE "BracketType" AS ENUM ('WINNERS', 'LOSERS');

-- CreateTable
CREATE TABLE "PlayoffGame" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leagueId" TEXT NOT NULL,
    "bracket" "BracketType" NOT NULL,
    "round" INTEGER NOT NULL,
    "matchupId" INTEGER NOT NULL,
    "placement" INTEGER,
    "isTitleGame" BOOLEAN NOT NULL DEFAULT false,
    "countsTowardRecord" BOOLEAN NOT NULL DEFAULT false,
    "topTeamId" TEXT,
    "bottomTeamId" TEXT,
    "winningTeamId" TEXT,
    "losingTeamId" TEXT,

    CONSTRAINT "PlayoffGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayoffGame_leagueId_idx" ON "PlayoffGame"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffGame_leagueId_bracket_matchupId_key" ON "PlayoffGame"("leagueId", "bracket", "matchupId");

-- AddForeignKey
ALTER TABLE "PlayoffGame" ADD CONSTRAINT "PlayoffGame_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffGame" ADD CONSTRAINT "PlayoffGame_topTeamId_fkey" FOREIGN KEY ("topTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffGame" ADD CONSTRAINT "PlayoffGame_bottomTeamId_fkey" FOREIGN KEY ("bottomTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffGame" ADD CONSTRAINT "PlayoffGame_winningTeamId_fkey" FOREIGN KEY ("winningTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffGame" ADD CONSTRAINT "PlayoffGame_losingTeamId_fkey" FOREIGN KEY ("losingTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
