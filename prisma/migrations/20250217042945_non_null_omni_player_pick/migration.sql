-- DropForeignKey
ALTER TABLE "OmniDraftPick" DROP CONSTRAINT "OmniDraftPick_playerId_fkey";

-- AlterTable
ALTER TABLE "OmniDraftPick" ALTER COLUMN "playerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "OmniDraftPick" ADD CONSTRAINT "OmniDraftPick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "OmniPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
