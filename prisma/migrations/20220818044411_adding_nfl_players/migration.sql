-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "sleeperId" TEXT NOT NULL,
    "fantasyDataId" INTEGER NOT NULL,
    "rotowireId" INTEGER NOT NULL,
    "rotoworldId" INTEGER NOT NULL,
    "yahooId" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_sleeperId_key" ON "Player"("sleeperId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_fantasyDataId_key" ON "Player"("fantasyDataId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_rotowireId_key" ON "Player"("rotowireId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_rotoworldId_key" ON "Player"("rotoworldId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_yahooId_key" ON "Player"("yahooId");
