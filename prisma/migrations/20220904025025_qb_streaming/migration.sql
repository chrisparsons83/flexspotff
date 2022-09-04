-- CreateTable
CREATE TABLE "QBStreamingWeek" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL,
    "isScored" BOOLEAN NOT NULL,

    CONSTRAINT "QBStreamingWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QBStreamingWeekOption" (
    "id" TEXT NOT NULL,
    "isDeep" BOOLEAN NOT NULL,
    "pointsScored" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "playerId" TEXT NOT NULL,
    "qbStreamingWeekId" TEXT NOT NULL,

    CONSTRAINT "QBStreamingWeekOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QBSelection" (
    "id" TEXT NOT NULL,
    "qbStreamingWeekId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "standardPlayerId" TEXT NOT NULL,
    "deepPlayerId" TEXT NOT NULL,

    CONSTRAINT "QBSelection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QBStreamingWeekOption" ADD CONSTRAINT "QBStreamingWeekOption_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QBStreamingWeekOption" ADD CONSTRAINT "QBStreamingWeekOption_qbStreamingWeekId_fkey" FOREIGN KEY ("qbStreamingWeekId") REFERENCES "QBStreamingWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QBSelection" ADD CONSTRAINT "QBSelection_qbStreamingWeekId_fkey" FOREIGN KEY ("qbStreamingWeekId") REFERENCES "QBStreamingWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QBSelection" ADD CONSTRAINT "QBSelection_standardPlayerId_fkey" FOREIGN KEY ("standardPlayerId") REFERENCES "QBStreamingWeekOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QBSelection" ADD CONSTRAINT "QBSelection_deepPlayerId_fkey" FOREIGN KEY ("deepPlayerId") REFERENCES "QBStreamingWeekOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QBSelection" ADD CONSTRAINT "QBSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
