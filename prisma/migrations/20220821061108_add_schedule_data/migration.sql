-- CreateTable
CREATE TABLE "NFLGame" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "homeTeamScore" INTEGER NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "awayTeamScore" INTEGER NOT NULL,

    CONSTRAINT "NFLGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NFLTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "mascot" TEXT NOT NULL,
    "logo" TEXT,

    CONSTRAINT "NFLTeam_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "NFLGame" ADD CONSTRAINT "NFLGame_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "NFLTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NFLGame" ADD CONSTRAINT "NFLGame_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "NFLTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
