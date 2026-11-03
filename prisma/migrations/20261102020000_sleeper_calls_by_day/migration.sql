-- AlterTable
ALTER TABLE "ScheduledJobRun" DROP COLUMN "totalSleeperCalls";

-- CreateTable
CREATE TABLE "SleeperCallDay" (
    "jobName" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SleeperCallDay_pkey" PRIMARY KEY ("jobName","day")
);
