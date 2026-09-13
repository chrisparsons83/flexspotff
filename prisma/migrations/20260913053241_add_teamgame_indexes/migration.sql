-- CreateIndex
CREATE INDEX "TeamGame_teamId_week_idx" ON "TeamGame"("teamId", "week");

-- CreateIndex
CREATE INDEX "TeamGame_week_idx" ON "TeamGame"("week");
