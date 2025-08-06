-- CreateTable
CREATE TABLE "DraftSlotPreference" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "draftSlotId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "ranking" INTEGER NOT NULL,

    CONSTRAINT "DraftSlotPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DraftSlotPreference_userId_draftSlotId_key" ON "DraftSlotPreference"("userId", "draftSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftSlotPreference_userId_season_ranking_key" ON "DraftSlotPreference"("userId", "season", "ranking");

-- AddForeignKey
ALTER TABLE "DraftSlotPreference" ADD CONSTRAINT "DraftSlotPreference_draftSlotId_fkey" FOREIGN KEY ("draftSlotId") REFERENCES "DraftSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftSlotPreference" ADD CONSTRAINT "DraftSlotPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
