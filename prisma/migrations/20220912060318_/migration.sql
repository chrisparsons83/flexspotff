/*
  Warnings:

  - You are about to drop the column `isAboveMedian` on the `TeamGame` table. All the data in the column will be lost.
  - You are about to drop the column `isGameCompleted` on the `TeamGame` table. All the data in the column will be lost.
  - You are about to drop the column `isWinning` on the `TeamGame` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TeamGame" DROP COLUMN "isAboveMedian",
DROP COLUMN "isGameCompleted",
DROP COLUMN "isWinning";
