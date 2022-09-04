-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "currentNFLTeamId" TEXT;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_currentNFLTeamId_fkey" FOREIGN KEY ("currentNFLTeamId") REFERENCES "NFLTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
