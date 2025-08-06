-- AlterTable
ALTER TABLE "DFSSurvivorUserEntry" ADD COLUMN     "isScored" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DFSSurvivorUserWeek" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DraftSlot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "draftDateTime" TIMESTAMP(3) NOT NULL,
    "season" INTEGER NOT NULL,

    CONSTRAINT "DraftSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DraftSlot_draftDateTime_season_key" ON "DraftSlot"("draftDateTime", "season");

-- AddForeignKey
ALTER TABLE "DFSSurvivorUserWeek" ADD CONSTRAINT "DFSSurvivorUserWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
