/*
  Warnings:

  - Added the required column `cupId` to the `CupGame` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CupGame" ADD COLUMN     "cupId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "CupGame" ADD CONSTRAINT "CupGame_cupId_fkey" FOREIGN KEY ("cupId") REFERENCES "Cup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
