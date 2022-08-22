/*
  Warnings:

  - Added the required column `gameStartTime` to the `NFLGame` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "NFLGame" ADD COLUMN     "gameStartTime" TIMESTAMP(3) NOT NULL;
