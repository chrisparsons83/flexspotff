/*
  Warnings:

  - Added the required column `userId` to the `DfsSurvivorYear` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DfsSurvivorYear" ADD COLUMN     "userId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "DfsSurvivorYear" ADD CONSTRAINT "DfsSurvivorYear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
