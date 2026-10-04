-- CreateTable
CREATE TABLE "ScheduledJobRun" (
    "name" TEXT NOT NULL,
    "lastStartedAt" TIMESTAMP(3),
    "lastScheduledStartAt" TIMESTAMP(3),
    "lastSucceededAt" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJobRun_pkey" PRIMARY KEY ("name")
);
