-- Re-file every league game as regular season or postseason from the league's
-- own playoffWeekStart, the boundary isRegularSeasonWeek uses.
--
-- The 20240917050428 backfill set this column from the old hardcoded boundary
-- (week 14 through 2020, week 15 from 2021), and leagues whose playoffWeekStart
-- was synced later kept those values. A NULL or non-positive playoffWeekStart
-- has not been synced, so it falls back to the same hardcoded boundary.
UPDATE "TeamGame" tg
SET "isRegularSeason" = tg."week" < CASE
    WHEN l."playoffWeekStart" > 0 THEN l."playoffWeekStart"
    WHEN l."year" >= 2021 THEN 15
    ELSE 14
  END
FROM "Team" t
JOIN "League" l ON t."leagueId" = l.id
WHERE tg."teamId" = t.id;
