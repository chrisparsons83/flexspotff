-- AlterTable
ALTER TABLE "NFLGame" ADD COLUMN     "week" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PoolWeek" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "weekNumber" INTEGER NOT NULL,

    CONSTRAINT "PoolWeek_pkey" PRIMARY KEY ("id")
);
