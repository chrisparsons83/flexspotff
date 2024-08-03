/*
  Warnings:

  - The `isActive` column on the `LocksGamePick` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "LocksGamePick" DROP COLUMN "isActive",
ADD COLUMN     "isActive" INTEGER NOT NULL DEFAULT 0;
