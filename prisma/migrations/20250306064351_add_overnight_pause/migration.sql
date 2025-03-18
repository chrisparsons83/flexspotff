-- AlterTable
ALTER TABLE "OmniSeason" ADD COLUMN     "hasOvernightPause" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pauseEnd" TIMESTAMP(3),
ADD COLUMN     "pauseStart" TIMESTAMP(3);
