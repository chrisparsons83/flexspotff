-- Add nullable seasonId columns first so existing rows can be backfilled
ALTER TABLE "DraftSlot" ADD COLUMN "seasonId" TEXT;
ALTER TABLE "DraftSlotPreference" ADD COLUMN "seasonId" TEXT;

-- CopyExistingData: map DraftSlot.season (year) to the matching Season row
UPDATE "DraftSlot" ds
SET "seasonId" = s."id"
FROM "Season" s
WHERE s."year" = ds."season";

-- CopyExistingData: inherit each preference's season from its draft slot
UPDATE "DraftSlotPreference" dp
SET "seasonId" = ds."seasonId"
FROM "DraftSlot" ds
WHERE ds."id" = dp."draftSlotId";

-- Enforce NOT NULL. This fails loudly if any row could not be matched to a
-- Season (e.g. a DraftSlot year with no Season row), rather than orphaning data.
ALTER TABLE "DraftSlot" ALTER COLUMN "seasonId" SET NOT NULL;
ALTER TABLE "DraftSlotPreference" ALTER COLUMN "seasonId" SET NOT NULL;

-- Replace the (draftDateTime, season) unique index with (draftDateTime, seasonId)
DROP INDEX "DraftSlot_draftDateTime_season_key";
CREATE UNIQUE INDEX "DraftSlot_draftDateTime_seasonId_key" ON "DraftSlot"("draftDateTime", "seasonId");

-- Season.year is now unique (fails loudly if duplicate-year rows exist)
CREATE UNIQUE INDEX "Season_year_key" ON "Season"("year");

-- Remove the old integer year columns and the now-unused ranking column
ALTER TABLE "DraftSlot" DROP COLUMN "season";
ALTER TABLE "DraftSlotPreference" DROP COLUMN "season";
ALTER TABLE "DraftSlotPreference" DROP COLUMN "ranking";

-- AddForeignKey
ALTER TABLE "DraftSlot" ADD CONSTRAINT "DraftSlot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DraftSlotPreference" ADD CONSTRAINT "DraftSlotPreference_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
