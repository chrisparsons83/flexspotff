/*
  Warnings:

  - A unique constraint covering the columns `[year]` on the table `Cup` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Cup_year_key" ON "Cup"("year");
