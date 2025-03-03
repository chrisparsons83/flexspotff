/*
  Warnings:

  - Added the required column `dfsSurvivorYearId` to the `DfsSurvivorWeek` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DfsSurvivorWeek" ADD COLUMN     "dfsSurvivorYearId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "DfsSurvivorYear" (
    "id" TEXT NOT NULL,

    CONSTRAINT "DfsSurvivorYear_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DfsSurvivorWeek" ADD CONSTRAINT "DfsSurvivorWeek_dfsSurvivorYearId_fkey" FOREIGN KEY ("dfsSurvivorYearId") REFERENCES "DfsSurvivorYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
