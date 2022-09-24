/*
  Warnings:

  - Added the required column `roundSort` to the `CupGame` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CupGame" ADD COLUMN     "roundSort" INTEGER NOT NULL;
