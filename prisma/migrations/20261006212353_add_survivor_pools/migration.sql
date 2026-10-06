-- CreateEnum
CREATE TYPE "SurvivorSource" AS ENUM ('SLEEPER', 'YAHOO');

-- CreateEnum
CREATE TYPE "SurvivorPickResult" AS ENUM ('WIN', 'LOSS', 'PENDING');

-- CreateTable
CREATE TABLE "SurvivorPool" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "source" "SurvivorSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "startWeek" INTEGER NOT NULL DEFAULT 1,
    "inviteUrl" TEXT,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "SurvivorPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurvivorEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT,
    "entryName" TEXT,
    "sleeperOwnerId" TEXT,
    "yahooGuid" TEXT,
    "userId" TEXT,
    "eliminatedWeek" INTEGER,
    "survivedWeek" INTEGER NOT NULL DEFAULT 0,
    "finish" INTEGER,
    "survivorPoolId" TEXT NOT NULL,

    CONSTRAINT "SurvivorEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurvivorPick" (
    "id" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "team" TEXT NOT NULL,
    "result" "SurvivorPickResult" NOT NULL,
    "survivorEntryId" TEXT NOT NULL,

    CONSTRAINT "SurvivorPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YahooUser" (
    "yahooGuid" TEXT NOT NULL,
    "userId" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SurvivorPool_externalId_key" ON "SurvivorPool"("externalId");

-- CreateIndex
CREATE INDEX "SurvivorPool_year_idx" ON "SurvivorPool"("year");

-- CreateIndex
CREATE INDEX "SurvivorEntry_userId_idx" ON "SurvivorEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SurvivorEntry_survivorPoolId_externalId_key" ON "SurvivorEntry"("survivorPoolId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SurvivorPick_survivorEntryId_week_key" ON "SurvivorPick"("survivorEntryId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "YahooUser_yahooGuid_key" ON "YahooUser"("yahooGuid");

-- AddForeignKey
ALTER TABLE "SurvivorEntry" ADD CONSTRAINT "SurvivorEntry_survivorPoolId_fkey" FOREIGN KEY ("survivorPoolId") REFERENCES "SurvivorPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurvivorEntry" ADD CONSTRAINT "SurvivorEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurvivorPick" ADD CONSTRAINT "SurvivorPick_survivorEntryId_fkey" FOREIGN KEY ("survivorEntryId") REFERENCES "SurvivorEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YahooUser" ADD CONSTRAINT "YahooUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
