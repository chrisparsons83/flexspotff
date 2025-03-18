-- CreateTable
CREATE TABLE "OmniSportEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sportId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "OmniSportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OmniSportEventPoints" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "OmniSportEventPoints_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OmniSportEvent" ADD CONSTRAINT "OmniSportEvent_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "OmniSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmniSportEvent" ADD CONSTRAINT "OmniSportEvent_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "OmniSport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmniSportEventPoints" ADD CONSTRAINT "OmniSportEventPoints_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "OmniSportEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OmniSportEventPoints" ADD CONSTRAINT "OmniSportEventPoints_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "OmniPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
