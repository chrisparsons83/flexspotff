/*
  Warnings:

  - You are about to drop the column `fantasyDataId` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `rotowireId` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `rotoworldId` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `yahooId` on the `Player` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Player" DROP COLUMN "fantasyDataId",
DROP COLUMN "rotowireId",
DROP COLUMN "rotoworldId",
DROP COLUMN "yahooId";
