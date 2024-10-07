-- CreateTable
CREATE TABLE "SeasonWeek" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "seasonId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonWeek_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SeasonWeek" ADD CONSTRAINT "SeasonWeek_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
