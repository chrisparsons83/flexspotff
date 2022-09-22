-- CreateTable
CREATE TABLE "CupWeek" (
    "id" TEXT NOT NULL,
    "cupId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "mapping" TEXT NOT NULL DEFAULT E'',

    CONSTRAINT "CupWeek_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CupWeek" ADD CONSTRAINT "CupWeek_cupId_fkey" FOREIGN KEY ("cupId") REFERENCES "Cup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
