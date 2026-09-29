# Guillotine Leagues — Plan

## Context

Guillotine leagues run on Sleeper. Every week the lowest-scoring surviving team
is chopped: it is out, and its whole roster is released to waivers. Waivers are
therefore the heart of the format, and the order of chops is the story of a
season.

The site has run guillotine leagues since 2022: one league in 2022, and usually
two in parallel since then. None of it exists on the site today. This plan adds
an admin section to add and backfill the leagues, a members-only public section
under Games, live chop-line tracking during the season, and a Guillotine tab on
member profiles.

## Decisions locked in

| Question            | Decision                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| Shape               | Standalone contest modelled on D12: a season holds several leagues        |
| Placement           | Under Games (`/games/guillotine`) until the site-wide nav redesign        |
| Visibility          | Members only                                                              |
| Who was chopped     | Sleeper's elimination is the only source of truth. No derivation, no override |
| Rule variations     | None across 2022–present                                                  |
| Backfill            | Admin adds each 2022–2025 league by Sleeper URL, the same as a new league |
| Live season         | Yes: synced on the existing 5-minute live-scores job                      |
| Parallel leagues    | Fully independent: no combined standings or overall champion              |

## Phase 0 — Verify Sleeper's shapes (blocking)

The container this plan was written in could not reach `api.sleeper.app`, so
nothing below about Sleeper's guillotine data has been confirmed. Against one
real league, record:

- How `GET /v1/league/{id}` marks a guillotine league (settings type and flags).
- **Where Sleeper records an elimination**, and the week it happened. This
  decides the whole schema, since we trust it and nothing else. Check roster
  `settings` and `metadata`, the league object, and the matchups of the weeks
  after a chop.
- What a chopped roster looks like afterwards (empty `players`, kept owner?).
- The transaction type and leg of the mass release (`commissioner`? a `drops`
  batch with no `adds`?), and whether the players go through the Wednesday
  waiver batch like any other drop.
- Whether `matchup_id` is null for every team, since there are no opponents.
- The league's `scoring_settings`, needed for projections below.

Findings get written into `app/libs/sleeper/schemas.ts` and into this document
before the schema is finalised.

## Phase 1 — Schema

Mirrors D12's season → league shape, since most years run two leagues in
parallel.

- **`GuillotineSeason`**: `year` (unique), leagues.
- **`GuillotineLeague`**: `name`, `sleeperLeagueId` (unique), `sleeperDraftId`,
  `teamCount`, `scoringSettings` (JSON, for projections), season.
- **`GuillotineTeam`**: league, `rosterId`, `sleeperOwnerId`, `user?`,
  `choppedWeek?` (null = still alive, or the champion), `finish?`,
  `draftSlot?`. `choppedWeek` is copied from Sleeper, never computed.
- **`GuillotineWeekScore`**: team, `week`, `points`, `starters`,
  `startingPlayerPoints`, `players` (whole roster that week, which is what
  "players released" reads from), and live fields `projectedPoints` and
  `playersRemaining`.
- **`GuillotineTransaction`**: league, `week`, `sleeperLeg`, `type`
  (waiver / free agent / release), `status`, `bid`, `seq`, `notes`, roster,
  owner, `user?`, add and drop player (raw Sleeper key plus a `Player`
  relation, as `WaiverTransaction` does), `processedAt`, and
  `fromChoppedTeam?` so a claim can say where the player came from.
  `WaiverTransaction` is tied to the main `League` model, which is why this is
  a separate table rather than a reuse.
- **`GuillotineDraftPick`**: league, `sleeperId`, `pickNo`, `user?`.

## Phase 2 — Sync and admin

**`app/libs/guillotine-sync.server.ts`**, using the existing Sleeper wrappers
and `resolveLeagueOwners`:

- `syncGuillotineLeagueWeek`: matchup scores and rosters for one week, plus
  Sleeper's elimination state for each team.
- `syncGuillotineTransactions`: every transaction for a week, reusing the
  Sleeper leg handling documented in `waiver-sync.server.ts`.
- `syncGuillotineDraft`.
- `syncGuillotineLeague`: all of the above for every week, which is the
  backfill.

**Admin (`/admin/guillotine`)**, its own nav section in `admin.tsx`, copied
from the D12 admin:

- Season list: create or delete a year.
- Season page: add a league from a Sleeper URL (name and year read from
  Sleeper), with the unmatched-owner warning D12 shows. Per-league buttons:
  full sync / backfill, resync one week, sync draft, delete.
- Adding a 2022 league and pressing "full sync" is the whole backfill.

**Live season**: `syncCurrentWeekScores` in `scoring.server.ts` already resyncs
D12 every 5 minutes while NFL games are in progress. Guillotine hooks in beside
it. An hourly pass also syncs transactions, so waiver results appear on
Wednesday without an admin pressing anything.

## Phase 3 — Live projections

What the site already has:

- `NFLGame.status` per game, kept current by the same 5-minute job, so we know
  which starters' games have not started, are in progress, or are final.
- Sleeper projections via `getProjections`. `PlayerWeekScore.projection` stores
  only `pts_half_ppr`, which may not match the league's scoring, so the plan is
  to score Sleeper's projected stat line with the league's own
  `scoring_settings` (the keys match Sleeper stat keys).

Per team, while a week is live:

- **Points so far**: Sleeper's live matchup points.
- **Players remaining**: starters whose game has not finished.
- **Projected total**: points so far, plus the full projection for starters yet
  to play, plus the unplayed share of the projection for starters mid-game.
  The unplayed share is by game clock: with two minutes left in the first half
  the game is about 47% done, so the player is credited their points so far
  plus about 53% of their projection. Once a game is final, only the actual
  points count.

The live page ranks surviving teams by projected total and draws the **chop
line** above the bottom team, marking who is on the block and the margin
between the last safe team and the one below it.

## Phase 4 — Public pages (`/games/guillotine`, members only)

A Guillotine section in the Games sidebar, with a year picker and a
league picker, since most years have two leagues.

- **Season overview**: each league's champion, and the chop order.
- **League page / chop tracker**: a team × week grid showing survival, the
  score each week, the chopped team struck through from its chop week on, and
  the margin above the cut line each week.
- **Live week** (current season): the chop line view from Phase 3.
- **Week page**: scores ranked with the cut line; who was chopped, and the
  roster that was released; then the waiver claims that followed.
- **Waivers**: every claim, won and lost, filterable by week, member and
  player. Shows the winning bid against the losing ones, the biggest bids, FAAB
  remaining per team over the season, and where each chopped team's players
  ended up.
- **Draft board**: the existing `DraftBoard` component.

Every loader goes through the members-only gate.

## Phase 5 — Profile tab

Follows the D12 tab's structure:

- `app/models/profile/guillotine.server.ts`: loader data.
- `app/models/profile/guillotineProfile.ts`: pure builders, with tests.
- `app/routes/members.$userId.guillotine.tsx`: the tab.
- `'guillotine'` added to `PROFILE_TABS` and to `contestsPlayed` in
  `summary.server.ts`, and a Guillotine Champion badge in `badges.ts`.

Sections:

- **Career**: seasons played, titles, best finish, average weeks survived,
  closest escapes (smallest margin above the chop line), times chopped in
  week 1.
- **By season**: league, finish, week chopped, average score, FAAB spent.
- **Waivers**: claims won and lost, total FAAB spent, biggest bid, most-bid-on
  players.
- **Draft board** across all seasons.

## Testing

Unit tests for the pure pieces, in the style of the D12 tests:

- projection maths (not started / in progress / final)
- chop-line ranking and margin
- FAAB remaining over a season
- linking a claim to the chopped team a player came from
- profile builders

## Sequencing

1. Phase 0 verification (needs Sleeper access).
2. Schema and sync, plus admin: enough to backfill 2022–2025 and track 2026.
3. Live projections and the chop-line view, since the season is running.
4. The remaining public pages.
5. Profile tab.
