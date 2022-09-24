/*
  Warnings:

  - Added the required column `insideRoundSort` to the `CupGame` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CupGame" ADD COLUMN     "insideRoundSort" INTEGER NOT NULL;
