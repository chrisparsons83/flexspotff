# Production backfill runbook

The profile work added three columns and one table that start empty. Nothing
breaks without this backfill — profiles render, they just show no championships
and no sackos — so it can be run whenever, and re-run freely.

Every step is idempotent. Running any of it twice is safe.

## Before you start

- **Deploy the branch.** Migrations apply automatically: `start:production` runs
  `prisma migrate deploy` before booting. Three migrations land —
  `add_league_season_structure`, `add_playoff_games`,
  `add_playoff_advancing_team`.
- **You need admin.** Everything below is on `/admin/data`, gated by
  `requireAdmin`.
- **These calls are slow and sequential.** The bracket sync alone makes roughly
  two Sleeper requests per league across every season, then writes each bracket
  game one at a time — on the order of 40 leagues, so expect minutes rather than
  seconds. See _If a button appears to hang_ below.

---

## Step 1 — Season structure

`/admin/data` → **Resync League Season Structure**

Reads each league's `playoff_week_start` from Sleeper and works out whether it
played median games, for every league in every year.

Check it took:

```sql
SELECT year, COUNT(*) AS leagues,
       COUNT("playoffWeekStart") AS with_playoff_week,
       COUNT(*) FILTER (WHERE "hasMedianScoring") AS median_leagues
FROM "League"
GROUP BY year
ORDER BY year;
```

`with_playoff_week` should equal `leagues` for every year. A year short of that
means Sleeper no longer serves those leagues — not fatal, the historical
fallback still applies, but worth knowing.

Also skim the app logs for `Ignoring implausible playoff_week_start`. That means
Sleeper returned something impossible (a `0`) and it was rejected rather than
stored — the season keeps the historical boundary.

## Step 2 — Do you actually need to re-sync scores?

Step 1 only records the boundary; it does not reclassify existing games. Those
were backfilled in 2024 with a hardcoded rule, so they only need rewriting where
Sleeper disagrees with it. **Check first — this query costs nothing and usually
saves a long job:**

```sql
SELECT year, name, "playoffWeekStart",
       CASE WHEN year >= 2021 THEN 15 ELSE 14 END AS historical_rule
FROM "League"
WHERE "playoffWeekStart" IS NOT NULL
  AND "playoffWeekStart" <> CASE WHEN year >= 2021 THEN 15 ELSE 14 END
ORDER BY year, name;
```

**No rows → skip to step 3.** Every league matches what was already stored.

**Rows returned → those years need it.** For each year listed: `/admin/data` →
**Update Current Year Scores**, pick the year, run it. This re-pulls every week
of that season, so it is the slowest thing here. Only run the years the query
named.

## Step 3 — Playoff brackets

`/admin/data` → **Resync Playoff Brackets**

Pulls the winners and losers brackets for every league in every year. Leagues
Sleeper no longer serves are skipped with a warning rather than failing the run.

## Step 4 — Verify, and actually read this one

This is the check that matters, because you know the answers and the code does
not:

```sql
SELECT l.year, l.name AS league,
       CASE pg.bracket WHEN 'WINNERS' THEN 'champion' ELSE 'sacko' END AS title,
       u."discordName"
FROM "PlayoffGame" pg
JOIN "League" l ON pg."leagueId" = l.id
JOIN "Team" t ON pg."advancingTeamId" = t.id
JOIN "User" u ON t."userId" = u.id
WHERE pg."isTitleGame" = true
ORDER BY l.year DESC, l.tier, pg.bracket;
```

One champion and one sacko per league per season. **Spot-check a few seasons you
remember.** In particular check a sacko: that logic was wrong twice during
development, and the failure mode is that it names the _best_ of the non-playoff
teams rather than the worst.

Coverage, to see which seasons came back at all:

```sql
SELECT l.year, COUNT(DISTINCT pg."leagueId") AS leagues_with_brackets,
       COUNT(*) AS games
FROM "PlayoffGame" pg
JOIN "League" l ON pg."leagueId" = l.id
GROUP BY l.year
ORDER BY l.year;
```

Older seasons may be missing if Sleeper has aged those leagues out. That is
expected and harmless — those seasons simply show no championship.

Then load `/leagues/records` → **Playoffs** and confirm the four tables are
populated, and any member profile at `/members/:userId/league`.

---

## If a button appears to hang

The work is sequential and can outlast the browser's patience. If the request
times out, **the server usually keeps going** — wait a minute, then run the
verification query rather than immediately clicking again.

If it genuinely did not finish, just click it again. Bracket games are keyed on
league + bracket + matchup, and league settings are a plain update, so a second
run corrects and completes rather than duplicating.

## If the brackets come out wrong

`PlayoffGame` is entirely derived — nothing references it, and no other feature
reads it except the profile and the Record Books' Playoffs tab. Clearing it is
safe:

```sql
DELETE FROM "PlayoffGame";
```

Then fix the cause and re-run step 3. The same is true of the two `League`
columns: setting `playoffWeekStart` back to `NULL` returns those leagues to the
historical rule.

## What this does not do

Nothing here touches `Team`, `TeamGame`, or any existing standings — except step
2, which rewrites `isRegularSeason`, and only for the years the query in that
step names.
