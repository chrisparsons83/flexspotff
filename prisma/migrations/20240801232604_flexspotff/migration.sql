/*
  Warnings:

  - Added the required column `homeSpread` to the `LocksGame` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LocksGame" ADD COLUMN     "homeSpread" DOUBLE PRECISION NOT NULL;
