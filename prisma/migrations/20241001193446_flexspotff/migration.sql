/*
  Warnings:

  - A unique constraint covering the columns `[uniqueId]` on the table `QBStreamingWeekOption` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "QBStreamingWeekOption" ADD COLUMN     "uniqueId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "QBStreamingWeekOption_uniqueId_key" ON "QBStreamingWeekOption"("uniqueId");
