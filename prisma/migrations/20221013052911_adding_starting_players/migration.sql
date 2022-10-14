-- CreateTable
CREATE TABLE "_PlayerToTeamGame" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PlayerToTeamGame_AB_unique" ON "_PlayerToTeamGame"("A", "B");

-- CreateIndex
CREATE INDEX "_PlayerToTeamGame_B_index" ON "_PlayerToTeamGame"("B");

-- AddForeignKey
ALTER TABLE "_PlayerToTeamGame" ADD CONSTRAINT "_PlayerToTeamGame_A_fkey" FOREIGN KEY ("A") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlayerToTeamGame" ADD CONSTRAINT "_PlayerToTeamGame_B_fkey" FOREIGN KEY ("B") REFERENCES "TeamGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
