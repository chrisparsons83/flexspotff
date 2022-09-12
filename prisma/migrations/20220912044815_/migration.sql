-- CreateTable
CREATE TABLE "TeamGame" (
    "id" TEXT NOT NULL,
    "sleeperMatchupId" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "pointsScored" DOUBLE PRECISION NOT NULL,
    "isAboveMedian" BOOLEAN NOT NULL,
    "isGameCompleted" BOOLEAN NOT NULL,
    "isWinning" BOOLEAN NOT NULL,
    "teamId" TEXT,

    CONSTRAINT "TeamGame_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TeamGame" ADD CONSTRAINT "TeamGame_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
