-- AlterTable
ALTER TABLE "CupGame" ADD COLUMN     "losingTeamId" TEXT;

-- AddForeignKey
ALTER TABLE "CupGame" ADD CONSTRAINT "CupGame_losingTeamId_fkey" FOREIGN KEY ("losingTeamId") REFERENCES "CupTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
