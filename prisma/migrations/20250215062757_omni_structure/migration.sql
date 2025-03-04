-- CreateTable
CREATE TABLE "OmniDraftPick" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pickNumber" INTEGER NOT NULL,
    "pickStartTime" TIMESTAMP(3),
    "pickMadeTime" TIMESTAMP(3),
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "OmniDraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmniSeason" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OmniSeason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmniUserTeam" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "OmniUserTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmniSport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "OmniSport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmniPlayer" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pointsScored" INTEGER,
    "sportId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,

    CONSTRAINT "OmniPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_OmniSeasonToOmniSport" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "OmniDraftPick_pickNumber_teamId_key" ON "OmniDraftPick"("pickNumber", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "OmniDraftPick_playerId_key" ON "OmniDraftPick"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "_OmniSeasonToOmniSport_AB_unique" ON "_OmniSeasonToOmniSport"("A", "B");

-- CreateIndex
CREATE INDEX "_OmniSeasonToOmniSport_B_index" ON "_OmniSeasonToOmniSport"("B");

-- AddForeignKey
ALTER TABLE "OmniDraftPick" ADD CONSTRAINT "OmniDraftPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "OmniUserTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmniDraftPick" ADD CONSTRAINT "OmniDraftPick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "OmniPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmniUserTeam" ADD CONSTRAINT "OmniUserTeam_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "OmniSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmniUserTeam" ADD CONSTRAINT "OmniUserTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmniPlayer" ADD CONSTRAINT "OmniPlayer_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "OmniSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmniPlayer" ADD CONSTRAINT "OmniPlayer_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "OmniSport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OmniSeasonToOmniSport" ADD CONSTRAINT "_OmniSeasonToOmniSport_A_fkey" FOREIGN KEY ("A") REFERENCES "OmniSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OmniSeasonToOmniSport" ADD CONSTRAINT "_OmniSeasonToOmniSport_B_fkey" FOREIGN KEY ("B") REFERENCES "OmniSport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
