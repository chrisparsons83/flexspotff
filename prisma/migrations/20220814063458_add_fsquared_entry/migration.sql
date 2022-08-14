-- CreateTable
CREATE TABLE "FSquaredEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FSquaredEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FSquaredEntryToTeam" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FSquaredEntry_year_userId_key" ON "FSquaredEntry"("year", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "_FSquaredEntryToTeam_AB_unique" ON "_FSquaredEntryToTeam"("A", "B");

-- CreateIndex
CREATE INDEX "_FSquaredEntryToTeam_B_index" ON "_FSquaredEntryToTeam"("B");

-- AddForeignKey
ALTER TABLE "FSquaredEntry" ADD CONSTRAINT "FSquaredEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FSquaredEntryToTeam" ADD CONSTRAINT "_FSquaredEntryToTeam_A_fkey" FOREIGN KEY ("A") REFERENCES "FSquaredEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FSquaredEntryToTeam" ADD CONSTRAINT "_FSquaredEntryToTeam_B_fkey" FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
