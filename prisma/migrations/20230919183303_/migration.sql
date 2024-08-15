-- CreateTable
CREATE TABLE "LocksWeek" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "isWeekScored" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LocksWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocksGame" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "locksWeekId" TEXT,

    CONSTRAINT "LocksGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocksWeekMissed" (
    "id" TEXT NOT NULL,
    "locksWeekId" TEXT,
    "userId" TEXT NOT NULL,
    "isWin" INTEGER NOT NULL DEFAULT 0,
    "isTie" INTEGER NOT NULL DEFAULT 0,
    "isLoss" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LocksWeekMissed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocksGamePick" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isScored" BOOLEAN DEFAULT false,
    "isWin" INTEGER NOT NULL DEFAULT 0,
    "isTie" INTEGER NOT NULL DEFAULT 0,
    "isLoss" INTEGER NOT NULL DEFAULT 0,
    "teamBetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locksGameId" TEXT NOT NULL,

    CONSTRAINT "LocksGamePick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocksWeek_year_weekNumber_key" ON "LocksWeek"("year", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LocksGame_gameId_key" ON "LocksGame"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "LocksWeekMissed_userId_locksWeekId_key" ON "LocksWeekMissed"("userId", "locksWeekId");

-- CreateIndex
CREATE UNIQUE INDEX "LocksGamePick_userId_locksGameId_teamBetId_key" ON "LocksGamePick"("userId", "locksGameId", "teamBetId");

-- AddForeignKey
ALTER TABLE "LocksGame" ADD CONSTRAINT "LocksGame_locksWeekId_fkey" FOREIGN KEY ("locksWeekId") REFERENCES "LocksWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocksGame" ADD CONSTRAINT "LocksGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "NFLGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocksWeekMissed" ADD CONSTRAINT "LocksWeekMissed_locksWeekId_fkey" FOREIGN KEY ("locksWeekId") REFERENCES "LocksWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocksWeekMissed" ADD CONSTRAINT "LocksWeekMissed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocksGamePick" ADD CONSTRAINT "LocksGamePick_locksGameId_fkey" FOREIGN KEY ("locksGameId") REFERENCES "LocksGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocksGamePick" ADD CONSTRAINT "LocksGamePick_teamBetId_fkey" FOREIGN KEY ("teamBetId") REFERENCES "NFLTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocksGamePick" ADD CONSTRAINT "LocksGamePick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
