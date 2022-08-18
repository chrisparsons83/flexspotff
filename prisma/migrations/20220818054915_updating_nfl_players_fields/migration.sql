/*
  Warnings:

  - Added the required column `nflTeam` to the `Player` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Player_fantasyDataId_key";

-- DropIndex
DROP INDEX "Player_rotowireId_key";

-- DropIndex
DROP INDEX "Player_rotoworldId_key";

-- DropIndex
DROP INDEX "Player_yahooId_key";

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "nflTeam" TEXT NOT NULL,
ALTER COLUMN "fantasyDataId" DROP NOT NULL,
ALTER COLUMN "rotowireId" DROP NOT NULL,
ALTER COLUMN "rotoworldId" DROP NOT NULL,
ALTER COLUMN "yahooId" DROP NOT NULL;
