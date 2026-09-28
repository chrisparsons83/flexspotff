-- AlterTable
ALTER TABLE "User" ADD COLUMN     "discordGlobalName" TEXT,
ADD COLUMN     "discordGuildAvatar" TEXT,
ADD COLUMN     "discordNick" TEXT,
ADD COLUMN     "discordSyncedAt" TIMESTAMP(3),
ADD COLUMN     "discordUserAvatar" TEXT,
ADD COLUMN     "discordUsername" TEXT,
ADD COLUMN     "inGuild" BOOLEAN;

-- CreateTable
CREATE TABLE "UserNameHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserNameHistory_userId_name_key" ON "UserNameHistory"("userId", "name");

-- AddForeignKey
ALTER TABLE "UserNameHistory" ADD CONSTRAINT "UserNameHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every member's current name is the first entry in their history.
INSERT INTO "UserNameHistory" ("id", "userId", "name", "firstSeenAt", "lastSeenAt")
SELECT 'unh_' || "id", "id", "discordName", "createdAt", CURRENT_TIMESTAMP
FROM "User"
WHERE "mergedIntoId" IS NULL;
