-- AlterTable
ALTER TABLE "CupGame" ADD COLUMN     "winnerToGameId" TEXT,
ADD COLUMN     "winnerToTop" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "topTeamId" DROP NOT NULL,
ALTER COLUMN "bottomTeamId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CupGame" ADD CONSTRAINT "CupGame_winnerToGameId_fkey" FOREIGN KEY ("winnerToGameId") REFERENCES "CupGame"("id") ON DELETE SET NULL ON UPDATE CASCADE;
