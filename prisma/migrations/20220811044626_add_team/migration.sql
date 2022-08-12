-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teamName" TEXT NOT NULL,
    "wins" INTEGER NOT NULL,
    "ties" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "sleeperOwnerId" TEXT NOT NULL,
    "pointsFor" DOUBLE PRECISION NOT NULL,
    "pointsAgainst" DOUBLE PRECISION NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
