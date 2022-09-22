-- CreateTable
CREATE TABLE "Cup" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "Cup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CupTeam" (
    "id" TEXT NOT NULL,
    "cupId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,

    CONSTRAINT "CupTeam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CupTeam_teamId_key" ON "CupTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "CupTeam_cupId_seed_key" ON "CupTeam"("cupId", "seed");

-- AddForeignKey
ALTER TABLE "CupTeam" ADD CONSTRAINT "CupTeam_cupId_fkey" FOREIGN KEY ("cupId") REFERENCES "Cup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupTeam" ADD CONSTRAINT "CupTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
