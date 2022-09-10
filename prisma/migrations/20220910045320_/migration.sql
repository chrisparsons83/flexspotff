-- CreateTable
CREATE TABLE "PoolWeekMissed" (
    "id" TEXT NOT NULL,
    "poolWeekId" TEXT,
    "userId" TEXT NOT NULL,
    "resultWonLoss" INTEGER DEFAULT -20,

    CONSTRAINT "PoolWeekMissed_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PoolWeekMissed" ADD CONSTRAINT "PoolWeekMissed_poolWeekId_fkey" FOREIGN KEY ("poolWeekId") REFERENCES "PoolWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolWeekMissed" ADD CONSTRAINT "PoolWeekMissed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
