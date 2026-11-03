-- CreateTable
CREATE TABLE "TeamPlannedLineup" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "week" INTEGER NOT NULL,
    "starters" TEXT[],
    "isOptimal" BOOLEAN NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "TeamPlannedLineup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamPlannedLineup_teamId_week_key" ON "TeamPlannedLineup"("teamId", "week");

-- AddForeignKey
ALTER TABLE "TeamPlannedLineup" ADD CONSTRAINT "TeamPlannedLineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
