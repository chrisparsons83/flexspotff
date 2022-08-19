/*
  Warnings:

  - A unique constraint covering the columns `[pickNumber,teamId]` on the table `DraftPick` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_pickNumber_teamId_key" ON "DraftPick"("pickNumber", "teamId");
