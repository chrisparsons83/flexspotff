-- CreateTable
CREATE TABLE "OmniScore" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "playerId" TEXT,
    "pointsAdded" INTEGER NOT NULL,
    "isEliminated" BOOLEAN NOT NULL,

    CONSTRAINT "OmniScore_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OmniScore" ADD CONSTRAINT "OmniScore_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "OmniPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
