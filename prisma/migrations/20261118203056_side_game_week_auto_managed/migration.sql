-- AlterTable
ALTER TABLE "LocksWeek" ADD COLUMN     "autoManaged" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "PoolWeek" ADD COLUMN     "autoManaged" BOOLEAN NOT NULL DEFAULT true;
