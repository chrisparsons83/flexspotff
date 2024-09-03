-- CreateTable
CREATE TABLE "SleeperUser" (
    "sleeperOwnerID" TEXT NOT NULL,
    "userId" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SleeperUser_sleeperOwnerID_key" ON "SleeperUser"("sleeperOwnerID");

-- AddForeignKey
ALTER TABLE "SleeperUser" ADD CONSTRAINT "SleeperUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CopyExistingData
INSERT INTO "SleeperUser"("userId", "sleeperOwnerID") SELECT "id", "sleeperOwnerID" FROM "User" WHERE "sleeperOwnerID" != '';

-- Remove Old Column
ALTER TABLE "User" DROP COLUMN IF EXISTS "sleeperOwnerID";