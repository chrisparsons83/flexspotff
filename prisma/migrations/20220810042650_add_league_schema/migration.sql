-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "sleeperLeagueId" TEXT NOT NULL,
    "sleeperDraftId" TEXT NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);
