-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mergedAt" TIMESTAMP(3),
ADD COLUMN     "mergedIntoId" TEXT;

-- CreateTable
CREATE TABLE "UserMerge" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duplicateId" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "movedRows" JSONB NOT NULL,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "UserMerge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMerge_duplicateId_idx" ON "UserMerge"("duplicateId");

-- CreateIndex
CREATE INDEX "UserMerge_canonicalId_idx" ON "UserMerge"("canonicalId");

-- CreateIndex
CREATE INDEX "User_mergedIntoId_idx" ON "User"("mergedIntoId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMerge" ADD CONSTRAINT "UserMerge_duplicateId_fkey" FOREIGN KEY ("duplicateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMerge" ADD CONSTRAINT "UserMerge_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMerge" ADD CONSTRAINT "UserMerge_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
