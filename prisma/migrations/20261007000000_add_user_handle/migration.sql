-- AlterTable
ALTER TABLE "User" ADD COLUMN "handle" TEXT;

-- Backfill. Must match toHandleBase() and claimHandle() in
-- app/models/handle.server.ts: the Discord @username if known, else the server
-- name made URL-safe, with -2, -3... added on a clash.
--
-- Live members claim handles first, then sheet-only stubs, then merged-away
-- tombstones, so a real member never loses their name to a placeholder.
DO $$
DECLARE
  member RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR member IN
    SELECT "id", "discordId", "discordName", "discordUsername"
    FROM "User"
    ORDER BY
      ("mergedIntoId" IS NOT NULL),
      ("discordId" LIKE 'legacy:%'),
      "createdAt",
      "id"
  LOOP
    base := lower(coalesce(member."discordUsername", member."discordName"));
    base := regexp_replace(base, '[\s-]+', '-', 'g');
    base := regexp_replace(base, '[^a-z0-9_.-]', '', 'g');
    base := regexp_replace(base, '-+', '-', 'g');
    base := regexp_replace(base, '^[-.]+|[-.]+$', '', 'g');
    IF base = '' THEN
      base := 'member';
    END IF;

    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM "User" WHERE "handle" = candidate) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;

    UPDATE "User" SET "handle" = candidate WHERE "id" = member."id";
  END LOOP;
END $$;

ALTER TABLE "User" ALTER COLUMN "handle" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");
