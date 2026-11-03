-- AlterTable
ALTER TABLE "ScheduledJobRun" ADD COLUMN     "lastSleeperCalls" INTEGER,
ADD COLUMN     "totalSleeperCalls" INTEGER NOT NULL DEFAULT 0;
