-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL,
    "isOpenForRegistration" BOOLEAN NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);
