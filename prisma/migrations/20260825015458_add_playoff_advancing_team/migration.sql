-- AlterTable
ALTER TABLE "PlayoffGame" ADD COLUMN     "advancingTeamId" TEXT;

-- AddForeignKey
ALTER TABLE "PlayoffGame" ADD CONSTRAINT "PlayoffGame_advancingTeamId_fkey" FOREIGN KEY ("advancingTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
