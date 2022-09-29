/*
  Warnings:

  - You are about to drop the column `isScored` on the `CupGame` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CupGame" DROP COLUMN "isScored",
ADD COLUMN     "winningTeamId" TEXT;

-- AddForeignKey
ALTER TABLE "CupGame" ADD CONSTRAINT "CupGame_winningTeamId_fkey" FOREIGN KEY ("winningTeamId") REFERENCES "CupTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
