/*
  Warnings:

  - You are about to drop the `DFSSurvivorServerYear` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DFSSurvivorUserYear" DROP CONSTRAINT "DFSSurvivorUserYear_year_fkey";

-- DropTable
DROP TABLE "DFSSurvivorServerYear";
