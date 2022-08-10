/*
  Warnings:

  - Added the required column `tier` to the `League` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "League" ADD COLUMN     "tier" INTEGER NOT NULL;
