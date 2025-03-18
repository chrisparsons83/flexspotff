/*
  Warnings:

  - You are about to drop the column `pauseEnd` on the `OmniSeason` table. All the data in the column will be lost.
  - You are about to drop the column `pauseStart` on the `OmniSeason` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "OmniSeason" DROP COLUMN "pauseEnd",
DROP COLUMN "pauseStart",
ADD COLUMN     "pauseEndHour" INTEGER,
ADD COLUMN     "pauseStartHour" INTEGER;
