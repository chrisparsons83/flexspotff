-- CreateTable
CREATE TABLE "PlayerWeekScore" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "points" DOUBLE PRECISION,
    "projection" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerWeekScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerWeekScore_year_week_idx" ON "PlayerWeekScore"("year", "week");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerWeekScore_playerId_year_week_key" ON "PlayerWeekScore"("playerId", "year", "week");

-- CreateIndex
CREATE INDEX "NFLGame_year_week_idx" ON "NFLGame"("year", "week");

-- AddForeignKey
ALTER TABLE "PlayerWeekScore" ADD CONSTRAINT "PlayerWeekScore_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
