/*
  Warnings:

  - Added the required column `sleeperId` to the `NFLTeam` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "NFLTeam" ADD COLUMN     "sleeperId" TEXT NOT NULL;
