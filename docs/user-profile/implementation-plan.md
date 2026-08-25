# User Profile — Implementation Plan

> **Status: implemented and verified against real Sleeper data.** Kept as the
> record of why the design is shaped this way.

## Context

FlexSpotFF has no member profile page. Building one surfaced two data gaps that
have to be closed first — the app cannot currently say when a season's regular
season ended, whether median games counted, or who won a league. Those gaps are
fixed here alongside the page itself, in one effort, so the profile launches
with real championship history rather than stubs.

Two of the fixes have value independent of the profile: the Record Books page
can currently only count Cup titles, and the regular-season boundary is
hardcoded in a way that will break again the next time the schedule changes.

---

## Phase 0 — Verification (blocking)

Both halves are now done. 0a settles the median era from the database alone; 0b
was confirmed against real Sleeper payloads, which corrected a wrong reading of
the losers bracket — see **The `p` trap**.

Existing median data is **confirmed correct** under the current sync code, so
pre-median seasons already parse to zeros and nothing needs repairing.

### 0a. Establish the median era — no network needed

Median scoring began partway through the site's history, and the design requires
detecting that from data rather than hardcoding a year. Because the stored data
is trustworthy, one query answers it:

```sql
SELECT l.year,
       COUNT(*) AS teams,
       SUM(t.wins + t.losses + t.ties) AS h2h_games,
       SUM(t."medianWins" + t."medianLosses" + t."medianTies") AS median_games
FROM "Team" t
JOIN "League" l ON t."leagueId" = l.id
GROUP BY l.year
ORDER BY l.year;
```

The invariant is one median game per week, so `median_games` is either equal to
`h2h_games` (median era) or zero (pre-median). **The first year it goes non-zero
is when median scoring started.** Run it per league as well as per year, in case
tiers differed within a season.

This also means the median half of Phase 1 needs no Sleeper call at all — see
below.

### 0b. Sleeper API shapes — needs network access

> **Resolved.** Real payloads were captured from league `335507311525122048` and
> are checked in under `test/fixtures/sleeper/`. The classifier is tested
> against them directly. Findings below.

```sh
# A real league id, from app/libs/league-sync.server.ts:41
L=335507311525122048
curl -s "https://api.sleeper.app/v1/league/$L"                  | jq '.settings, .season, .status'
curl -s "https://api.sleeper.app/v1/league/$L/winners_bracket"  | jq '.'
curl -s "https://api.sleeper.app/v1/league/$L/losers_bracket"   | jq '.'
curl -s "https://api.sleeper.app/v1/league/$L/rosters"          | jq '.[0].metadata.record'
```

What the real responses showed:

| Checked                                              | Result                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `settings.playoff_week_start`                        | **Exists** — `14` for this 2018 league, matching the historical fallback                              |
| `settings.league_average_match`                      | **Absent entirely.** Deriving the median era from `Team` rows was not a convenience, it was necessary |
| Bracket fields `r`/`m`/`t1`/`t2`/`w`/`l`/`_from`/`p` | **All present**, matching the zod schema                                                              |
| `t1`/`t2` are roster ids                             | **Confirmed**                                                                                         |
| `p` marks placement                                  | **Confirmed, and it restarts per bracket** — see below                                                |

### The `p` trap

The winner of a `p: N` game finishes Nth and the loser N+1 — but the numbering
restarts in each bracket. For twelve teams with six playoff spots:

| Bracket | `p: 1`      | `p: 3`   | `p: 5`        |
| ------- | ----------- | -------- | ------------- |
| Winners | 1st/2nd     | 3rd/4th  | 5th/6th       |
| Losers  | **7th/8th** | 9th/10th | **11th/12th** |

So the losers bracket's `p: 1` game decides _seventh_ — the best of the teams
who missed the playoffs. **The sacko is the loser of the highest `p`.** All
twelve places are covered exactly once, which is what proves the reading; there
is a test asserting precisely that.

An earlier attempt inferred which side advances by counting `w` versus `l`
links. Against the real brackets those counts **tie exactly, 4-4, in both** — a
Sleeper bracket branches both ways every round — so the heuristic was only ever
landing on its default. The placement markers are the reliable signal.

The real responses are checked in under `test/fixtures/sleeper/` and the
classifier is tested directly against them. It is the riskiest pure function
here, and inventing its inputs is what produced the wrong sacko twice.

---

## Phase 1 — Make season structure data-driven

Replaces the hardcoded rule at `app/libs/syncs.server.ts:283`:

```ts
const isRegularSeason = week <= 13 || (week === 14 && year >= 2021);
```

### Schema

Add to `League` in `prisma/schema.prisma`:

```prisma
playoffWeekStart Int?
hasMedianScoring Boolean @default(false)
```

Migration: `add_league_season_structure`. Nullable `playoffWeekStart` so
pre-backfill rows are distinguishable from real values.

`hasMedianScoring` is set from the league's own `Team` rows — non-zero median
games means median scoring was on — with `settings.league_average_match` used
only as a cross-check. **0b showed that key does not exist at all**, so deriving
it from `Team` rows is the only way this works.

### Sync

- Add `sleeperLeagueJson` zod schema to `app/utils/types.ts` covering the
  settings keys.
- In `syncLeague` (`app/libs/league-sync.server.ts:22`), add the league endpoint
  to the existing `Promise.all` of rosters + draft, and write both fields.
- **`updateLeague` (`app/models/league.server.ts:111`) destructures an explicit
  whitelist** — the two new fields must be added there or they will be silently
  dropped. That whitelist is deliberate (PR #140); don't loosen it.

### Consume

- `syncSleeperWeeklyScores` resolves `isRegularSeason` from the league's
  `playoffWeekStart` (`week < playoffWeekStart`), falling back to the old
  hardcoded rule only when the field is null, so a partial backfill can't
  corrupt data.
- The median parser (`league-sync.server.ts:105-118`) is left alone. It produces
  correct values today, and `hasMedianScoring` is only used downstream to decide
  whether a season's median record is summed into a combined record.

### Backfill

- New admin action `resyncLeagueSettings` in `app/routes/admin.data._index.tsx`,
  following the existing `switch (action)` pattern, looping every league from
  `FIRST_YEAR`.
- Then re-run `resyncCurrentYearScores` per year to correct `isRegularSeason` on
  existing `TeamGame` rows.
- **Regression check:** re-run the Phase 0a query and confirm it is unchanged.
  The backfill touches `isRegularSeason` and the two new `League` columns; if
  any year's median or H2H game counts move, something went wrong.

---

## Phase 2 — Playoff brackets

### Schema

```prisma
enum BracketType {
  WINNERS
  LOSERS
}

model PlayoffGame {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  league   League @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  leagueId String

  bracket   BracketType
  round     Int
  matchupId Int // Sleeper's `m`
  placement Int? // Sleeper's `p`

  /// True only for the game that decides the bracket's title.
  isTitleGame        Boolean @default(false)
  /// True only for games on the path to the title. Third-place, seventh-place
  /// and other placement games are stored but excluded from playoff records.
  countsTowardRecord Boolean @default(false)

  topTeamId     String?
  bottomTeamId  String?
  winningTeamId String?
  losingTeamId  String?
  // ...four Team relations, mirroring CupGame's naming

  @@unique([leagueId, bracket, matchupId])
  @@index([leagueId])
}
```

Naming deliberately mirrors `CupGame` (`prisma/schema.prisma:85`) so the two
bracket concepts read alike.

### Classification (the load-bearing logic)

Pure function, no I/O, unit-tested against Phase 0 fixtures:

```
classifyBracket(entries: SleeperBracketEntry[]): ClassifiedGame[]
```

1. Find the title game: the winners-bracket entry with `p === 1`, falling back
   to the highest round if `p` is absent.
2. Walk backwards through `t1_from` / `t2_from` to collect every ancestor. That
   ancestor set is the **title path**.
3. `countsTowardRecord = true` for title-path games only. A third-place game
   descends from _losses_, not wins, so it falls out naturally — but assert this
   against the fixtures rather than trusting the reasoning.
4. Everything else is stored with its placement and shown in the game log with a
   round label, but excluded from the record.
5. The losers bracket gets the same treatment; its title game decides the sacko.

> **Confirm before building:** in Sleeper's losers bracket, whether the
> `p === 1` _winner_ is the sacko or the team that escaped it. This inverts a
> badge, so it needs a human answer, not an inference.

### Sync + backfill

- New `app/libs/bracket-sync.server.ts` exporting `syncLeagueBrackets(league)`,
  mapping Sleeper roster ids to `Team` via `Team.rosterId` scoped to the league.
- Admin action `resyncBrackets` looping all leagues `FIRST_YEAR`→current.
- Add bracket sync to `jobs/sync-leagues.ts` so it stays current automatically.

### Payoff beyond the profile

Add `getPlayoffRecords()` to `app/models/records.server.ts` — most
championships, most playoff appearances, most sackos — and render it on
`/leagues/records`, which today can only count Cup titles.

---

## Phase 3 — Profile data layer

**`records.server.ts` already computes most of this.** Every function in it
builds a per-user aggregate and then discards everything but the top 50. The
profile needs the same aggregates, filtered to one member, with nothing
discarded. So this phase is mostly an _extraction_, not new logic:

| Already in `records.server.ts` | What it computes                                                  | Profile use          |
| ------------------------------ | ----------------------------------------------------------------- | -------------------- |
| `getCareerRecords:17-75`       | `Map<userId, CareerStats>` — seasons, W/L/T, median W/L/T, PF, PA | Hero career tiles    |
| `getSingleSeasonRecords:179`   | per-`Team` rows joined to league year + name                      | Season history table |
| `getSingleGameRecords:266`     | best / worst single weeks                                         | Splits               |
| `getCupRecords:330-430`        | per-user championships, finals, game wins, games played           | Cup tab, in full     |
| `getStreakRecords:512-560`     | matchup pairing → per-game W/L/T with year, week, league          | Game log + H2H       |
| `computeStreak:583`            | generic predicate-based streaks                                   | Badges               |

### The refactor

Extract the computation core into `app/models/profile/shared.server.ts`, then
have **both** consumers call it:

- `records.server.ts` becomes a thin wrapper — aggregate, sort, take 50, format
  as `RecordTable`.
- The profile calls the same aggregates filtered to one `userId`.

Functions to lift out:

- `pairTeamGames(games)` — the `leagueId:week:sleeperMatchupId` grouping at
  `records.server.ts:512-560`, returning both sides with W/L/T resolved
- `aggregateCareerStats(teams)` — the `Map<userId, CareerStats>` build at
  `:17-75`
- `aggregateCupStats(cupGames)` — the `getOrCreate` accumulation at `:374-430`
- `computeStreak(games, predicate)` — already generic, just move it
- `totalGames` / `winPct` / `avgPF` — **currently duplicated** between `:66-70`
  and `:188-193` with different parameter types; unify on one shape

This is worth doing on its own merits: it removes the duplication and gives the
Record Books page test coverage it doesn't have today.

### Precedents to follow, not reinvent

- **Cup rounds** are keyed by string with `ROUND_OF_2` meaning the final
  (`records.server.ts:410`), labelled via `roundNameMapping` in
  `app/utils/constants.ts:40`. The playoff bracket work in Phase 2 should label
  rounds the same way rather than inventing a second convention.
- **Merged accounts** need no special handling in aggregation — a merge
  re-points `Team.userId` at the canonical member, so grouping by `userId`
  already resolves correctly. Only the route needs the redirect.

### New per-contest modules

`app/models/profile/` — one `get<Contest>Profile(userId)` per side game (`d12`,
`qbStreaming`, `spreadPool`, `locks`, `dfsSurvivor`, `fSquared`, `omni`), plus
`summary.server.ts` for the hero. Each takes a `userId`, returns a plain typed
shape, and leaks no Prisma types. **That boundary is what lets these swap to
materialized summary tables later without touching a route.**

Existing per-user functions worth reusing rather than rewriting:
`getPoolGamePicksByUserAndYear`, `getLocksGamePicksByUserAndYear`,
`getDfsSurvivorYearByUserAndYear`, `getD12DraftPicksByUserAndLeagues`,
`getOmniUserTeamByUserIdAndSeason`. Most are year-scoped, so career views need
all-years variants alongside them.

### Record math

Combined record is only summed for seasons where that league's
`hasMedianScoring` is true. Pre-median seasons show the H2H record with a
footnote — never a fabricated combined number.

---

## Phase 4 — Routes and components

Remix flat routes under `app/routes/`:

```
members.$userId.tsx           parent: auth gate, hero, tab bar, <Outlet />
members.$userId._index.tsx    redirect → ./league
members.$userId.league.tsx
members.$userId.cup.tsx
members.$userId.d12.tsx
members.$userId.qb-streaming.tsx
members.$userId.spread-pool.tsx
members.$userId.locks.tsx
members.$userId.dfs-survivor.tsx
members.$userId.f-squared.tsx
members.$userId.omni.tsx
```

Parent loader:

```ts
await authenticator.isAuthenticated(request, { failureRedirect: '/login' });
```

…matching `app/routes/admin.data._index.tsx:41`. Members-only, per the design
decision. If the requested user has `mergedIntoId` set, redirect to the
canonical member's profile rather than rendering a tombstone.

Components in `app/components/layout/profile/`:

`ProfileHero.tsx` · `StatTile.tsx` · `BadgeRow.tsx` · `ProfileTabs.tsx` ·
`CareerByTierTable.tsx` · `SeasonHistoryTable.tsx` · `GameLogTable.tsx` ·
`HeadToHeadTable.tsx` · `ContestEmptyState.tsx`

`ProfileTabs` is `Link`-based with `useLocation()` for active state — not the
shadcn `Tabs` primitive, which is client-state and would defeat per-tab loaders.
Avatar URL follows the existing convention:
`https://cdn.discordapp.com/${user.discordAvatar}` (`NavBar.tsx:25`). Tier
colors reuse `RANK_COLORS` from `app/utils/constants.ts:29`.

---

## Phase 5 — Discovery

- **`NavBar.tsx`** — add a "My Profile" `Menu.Item` linking to
  `/members/${user.id}`, directly above the existing "User Dashboard" item
  (`NavBar.tsx:120`).
- **Link member names** in `LeagueTable.tsx:43`, `LeaderboardRow.tsx`, the cup
  bracket, and the side-game standings components.
- **`RecordsTable.tsx` needs a shape change.** `RecordRow` is
  `{ cells: string[] }` (`records.server.ts:6`), which cannot carry a user id.
  Add an optional `playerUserId?: string` to `RecordRow` and have the table link
  the player cell when it is present. This touches every builder in
  `records.server.ts`, so it is the largest mechanical edit in this phase.

---

## Testing

Unit tests follow the existing mocked-Prisma pattern
(`app/models/league.test.ts:5`):

| Target                       | Why                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `classifyBracket()`          | Highest-risk logic. Test against Phase 0 fixtures: title path included, third-place excluded, byes, losers bracket |
| `pairTeamGames()`            | Unpaired games skipped, ties handled — guards the `records.server.ts` refactor                                     |
| `aggregateCareerStats()`     | Same — the extraction must not change what the Record Books page renders                                           |
| `aggregateCupStats()`        | `ROUND_OF_2` counts as both a finals appearance and a championship for the winner                                  |
| Badge derivation             | Thresholds fire exactly at the boundary                                                                            |
| Tier movement                | Promotion/relegation across a gap year                                                                             |
| `isRegularSeason` resolution | Uses `playoffWeekStart`; falls back correctly when null                                                            |

The extraction in Phase 3 is the one change that can silently break an existing
page. Write the `aggregate*` tests **before** moving the code, run them against
the current implementation, then confirm they still pass after — that turns an
untested refactor into a checked one, and leaves `/leagues/records` with
coverage it does not have today.

Then `npm run validate` (test + lint + typecheck).

**End-to-end check:** point at the shared test database, run the Phase 1 and
Phase 2 backfills, then load a profile for a long-tenured member and verify
season count, career record, and championships against `/leagues/standings` and
`/leagues/records` by hand.

---

## Risks

1. **Sleeper shapes are unverified.** Phase 0 gates everything. If
   `league_average_match` doesn't exist, the median era comes from the Phase 0a
   query instead, which needs no API at all.

2. **Bracket backfill depends on old leagues still resolving.** 2018–2020
   leagues may have aged out of Sleeper. Partial recovery is acceptable; the
   profile must render "no playoff data" for those seasons rather than implying
   a missed playoff berth.

3. ~~**Toilet bowl semantics need a human answer**~~ — **answered.** You advance
   in the sacko bracket by scoring _least_, so the sacko goes to whoever posts
   the lowest score in that bracket's final. Rather than hardcode that,
   `detectAdvancementDirection` reads the direction back out of the links
   Sleeper emits, so either shape produces the right answer. It is called the
   **sacko**, not the toilet bowl.

4. **The hero loads on every tab view.** It is the one cross-contest query that
   per-tab routing does not avoid, making `getProfileSummary` the first
   candidate for caching if this proves heavy.

---

## Sequencing

One effort, but naturally two reviewable PRs:

- **PR 1 — Data** (Phases 0–2): season structure, brackets, backfills, Record
  Books additions. Independently valuable and independently verifiable.
- **PR 2 — Page** (Phases 3–5): profile data layer, routes, components,
  discovery.

## Open questions carried over

Still unresolved from the design plan, all needed before or during Phase 3:

1. Badge thresholds — needs a pass against real data so badges stay rare enough
   to mean something
2. Do league playoff games count toward H2H? (assumed yes)
3. Does the hero "Titles" tile count league titles only, or league + Cup?
4. Empty-state wording for members who predate a contest
