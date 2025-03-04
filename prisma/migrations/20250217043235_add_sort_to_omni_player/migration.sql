/*
  Warnings:

  - Added the required column `relativeSort` to the `OmniPlayer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OmniPlayer" ADD COLUMN     "relativeSort" INTEGER NOT NULL;
