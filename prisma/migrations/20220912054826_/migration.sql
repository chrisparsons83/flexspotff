/*
  Warnings:

  - Made the column `teamId` on table `TeamGame` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "TeamGame" ALTER COLUMN "teamId" SET NOT NULL;
