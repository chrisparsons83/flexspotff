# Guillotine Leagues — Plan

## Context

Guillotine leagues run on Sleeper. Every week the lowest-scoring surviving team
is chopped: it is out, and its whole roster is released to waivers. Waivers are
therefore the heart of the format, and the order of chops is the story of a
season.

The site has run guillotine leagues since 2021: one league in 2021, and usually
two in parallel since then. None of it exists on the site today. This plan adds
an admin section to add and backfill the leagues, a members-only public section
under Games, live chop-line tracking during the season, and a Guillotine tab on
member profiles.

## Decisions locked in

| Question         | Decision                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| Shape            | Standalone contest modelled on D12: a season holds several leagues                                    |
| Placement        | Under Games (`/games/guillotine`) until the site-wide nav redesign                                    |
| Visibility       | Members only                                                                                          |
| Who was chopped  | What Sleeper recorded: `eliminated` on native leagues, the emptied roster on manual ones. No override |
| Rule variations  | None across 2021–present                                                                              |
| Backfill         | Admin adds each 2021–2025 league by Sleeper URL, the same as a new league                             |
| Live season      | Yes: synced on the existing 5-minute live-scores job                                                  |
| Parallel leagues | Fully independent: no combined standings or overall champion                                          |

## Phase 0 — What Sleeper returns (verified 2026-09-29)

Checked against three real leagues: the 2026 league (Sleeper's built-in
guillotine), the 2025 league (chops done by hand by the commissioner) and the
first league, from 2021 (chops by hand, and managers removed from the league
once it ended). Every league is 18 teams, half PPR, $1,000 FAAB, with the same
roster shape.

### Three formats, one signal

| Format                 | Seasons             | How Sleeper records a chop                                                                                                                                 |
| ---------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native                 | 2026 on             | League `settings.type === 3`. The roster gets `settings.eliminated = <week>` and `locked: 1`, and a `chopped` transaction drops its whole roster           |
| Manual                 | 2022–2025           | League `settings.type === 0`. The commissioner drops every player (one `commissioner` transaction per player) and the roster is left empty and `locked: 1` |
| Manual, owners removed | 2021 (first league) | As manual, but chopped rosters now have `owner_id: null`. The owner comes from the draft instead: every pick carries `picked_by` and `roster_id`           |

In all three, **a chopped team's roster is empty in every matchup from the week
after its chop**. For the native format that agrees with `eliminated` exactly.
For both manual leagues it picks out exactly one team per week, and that team
was the week's lowest scorer every single week, so the manual chop Sleeper
recorded matches the rules with no exceptions.

The rule the sync uses:

- **Native**: `choppedWeek = roster.settings.eliminated`.
- **Manual**: `choppedWeek` = the last week the roster had players, for any
  roster that is empty and locked now.
- **Both**: in week 17, the lower of the last two scores is chopped and the
  other team is champion.

This is still "trust Sleeper": it reads what the commissioner did in Sleeper, it
does not work out who should have been chopped.

### Other findings

- **Matchups**: native leagues give every roster its own `matchup_id`; the
  manual leagues kept normal head-to-head pairings, which the site ignores.
  Native leagues also pre-create zero-point rows for future weeks, so a week
  only counts once somebody has scored.
- **Weeks after the end**: the 2021 league shows every roster with players and
  points again in week 18, after the final. The sync stops at the final week.
- **Released players**: the chop week's matchup row lists the full roster in
  `players`, which is what "players released" is built from, whichever format
  the release transactions took.
- **Waivers**: the same shape as the main leagues (`waiver` claims, complete and
  failed, with `waiver_bid` and `seq`), and filed under the outgoing leg in the
  same way. The existing transaction schema already parses `chopped` and
  `commissioner` rows.
- **Final**: the last two teams are never emptied in the manual leagues, so the
  champion cannot be read from rosters. It comes from week 17's scores instead.
- **League history**: the "Guillotine for the People" leagues are linked by
  `previous_league_id` from 2022 to 2025. 2026 was cloned rather than continued,
  so it is not linked, and "Guillotine for Business Edition 2022" is a second,
  separate line.

### Settled after Phase 0

- The first league, "Last Minute Head-Cutting-Off League", is the **2021**
  season, and the history starts there.
- **Week 17 is the final, and week 18 never counts.** The last two teams play
  week 17 and the lower score is chopped, which makes the other team champion.
  This fits both manual years (2025: roster 14 beat roster 11, 118.80 to 114.48;
  2021: roster 3 beat roster 15, 154.00 to 95.36). The sync reads weeks 1–17
  only, which also sidesteps the 2021 week 18 rows.
- Leagues are only ever added through the admin page, including this season's.
  Nothing is hardcoded.

## Phase 1 — Schema

Mirrors D12's season → league shape, since most years run two leagues in
parallel.

- **`GuillotineSeason`**: `year` (unique), leagues.
- **`GuillotineLeague`**: `name`, `sleeperLeagueId` (unique), `sleeperDraftId`,
  `format` (`NATIVE` or `MANUAL`, read from `settings.type` when the league is
  added), `teamCount`, `scoringSettings` (JSON, for projections), season.
- **`GuillotineTeam`**: league, `rosterId`, `sleeperOwnerId`, `user?`,
  `choppedWeek?` (null = still alive, or the champion), `finish?`, `draftSlot?`.
  `choppedWeek` is read from Sleeper as Phase 0 describes. The owner falls back
  to the draft's `picked_by` when Sleeper's roster no longer has one (2021).
- **`GuillotineWeekScore`**: team, `week`, `points`, `starters`,
  `startingPlayerPoints`, `players` (whole roster that week, which is what
  "players released" reads from), and live fields `projectedPoints` and
  `playersRemaining`.
- **`GuillotineTransaction`**: league, `week`, `sleeperLeg`, `type` (waiver /
  free agent / trade / release, where release covers both `chopped` and the
  manual years' `commissioner` drops), `status`, `bid`, `seq`, `notes`, roster,
  owner, `user?`, add and drop player (raw Sleeper key plus a `Player` relation,
  as `WaiverTransaction` does), `processedAt`, and `fromChoppedTeam?` so a claim
  can say where the player came from. `WaiverTransaction` is tied to the main
  `League` model, which is why this is a separate table rather than a reuse.
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

**Admin (`/admin/guillotine`)**, its own nav section in `admin.tsx`, copied from
the D12 admin:

- Season list: create or delete a year.
- Season page: add a league from a Sleeper URL (name and year read from
  Sleeper), with the unmatched-owner warning D12 shows. Per-league buttons: full
  sync / backfill, resync one week, sync draft, delete.
- Adding a 2021 league and pressing "full sync" is the whole backfill.

**Live season**: `syncCurrentWeekScores` in `scoring.server.ts` already resyncs
D12 every 5 minutes while NFL games are in progress. Guillotine hooks in beside
it. An hourly pass also syncs transactions, so waiver results appear without an
admin pressing anything.

**Waiver timing is not the main leagues'.** Guillotine waivers run overnight
Wednesday into Thursday: every weekly run in the 2021, 2025 and 2026 leagues
landed between 00:00 and 00:06 Thursday Pacific, filed under the leg of the week
just played, so its claims are for the next week. Smaller clears later in the
week (Thursday night to Sunday morning) are filed under the new leg and are for
that same week. `waiverClaimWeek` in `app/libs/guillotine/views.ts` holds the
rule, tested against those real timestamps. Chops land Monday night (Sleeper's
own format) or Tuesday (by hand).

## Phase 3 — Live projections

**Built, with one gap.** Each starter's projection is scored with the league's
own `scoring_settings` at sync time (checked against Sleeper's own projected
totals: within 0.05 points) and stored in `starterProjections`. How far through
a game is comes from the time since kickoff (a game counted as about 185
minutes, and never treated as finished before it is final), because the game
clock lives on Sleeper's GraphQL endpoint at `sleeper.com`, which the
development container could not reach to confirm the field names. Swapping in
the real clock is a change to `gameProgress` in
`app/libs/guillotine/projection.ts` once those are confirmed. Teams with no
lineup yet are listed below the chop line instead of counting as the bottom.

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
  to play, plus the unplayed share of the projection for starters mid-game. The
  unplayed share is by game clock: with two minutes left in the first half the
  game is about 47% done, so the player is credited their points so far plus
  about 53% of their projection. Once a game is final, only the actual points
  count.

The live page ranks surviving teams by projected total and draws the **chop
line** above the bottom team, marking who is on the block and the margin between
the last safe team and the one below it.

## Phase 4 — Public pages (`/games/guillotine`, members only)

A Guillotine section in the Games sidebar, with a year picker and a league
picker, since most years have two leagues.

- **Season overview**: each league's champion, and the chop order.
- **League page / chop tracker**: a team × week grid showing survival, the score
  each week, the chopped team struck through from its chop week on, and the
  margin above the cut line each week.
- **Live week** (current season): the chop line view from Phase 3.
- **Week page**: scores ranked with the cut line; who was chopped, and the
  roster that was released; then the waiver claims that followed.
- **Waivers**: every claim, won and lost, filterable by week, member and player.
  Shows the winning bid against the losing ones, the biggest bids, FAAB
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

Status: all five steps are done.

1. Phase 0 verification (needs Sleeper access).
2. Schema and sync, plus admin: enough to backfill 2021–2025 and track 2026.
3. Live projections and the chop-line view, since the season is running.
4. The remaining public pages.
5. Profile tab.
