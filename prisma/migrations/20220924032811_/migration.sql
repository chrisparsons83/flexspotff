-- CreateTable
CREATE TABLE "CupGame" (
    "id" TEXT NOT NULL,
    "topTeamId" TEXT NOT NULL,
    "bottomTeamId" TEXT NOT NULL,

    CONSTRAINT "CupGame_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CupGame" ADD CONSTRAINT "CupGame_topTeamId_fkey" FOREIGN KEY ("topTeamId") REFERENCES "CupTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupGame" ADD CONSTRAINT "CupGame_bottomTeamId_fkey" FOREIGN KEY ("bottomTeamId") REFERENCES "CupTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
