/*
  Warnings:

  - Added the required column `round` to the `CupGame` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CupGame" ADD COLUMN     "round" TEXT NOT NULL;
