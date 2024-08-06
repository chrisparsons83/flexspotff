/*
  Warnings:

  - You are about to drop the `LocksWeekMissed` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LocksWeekMissed" DROP CONSTRAINT "LocksWeekMissed_locksWeekId_fkey";

-- DropForeignKey
ALTER TABLE "LocksWeekMissed" DROP CONSTRAINT "LocksWeekMissed_userId_fkey";

-- DropTable
DROP TABLE "LocksWeekMissed";
