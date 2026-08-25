# User Profile — Implementation Plan

Companion to `design-plan.md`. That document settles _what_ the page shows; this
one settles _how_ it gets built, in what order, and what could go wrong.

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

The Sleeper API shapes below have not been observed — network egress to
`api.sleeper.app` was denied by organization policy from the planning
environment — so they come from knowledge rather than from a response body.
Confirm them before building on them.

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

```sh
# A real league id, from app/libs/league-sync.server.ts:41
L=335507311525122048
curl -s "https://api.sleeper.app/v1/league/$L"                  | jq '.settings, .season, .status'
curl -s "https://api.sleeper.app/v1/league/$L/winners_bracket"  | jq '.'
curl -s "https://api.sleeper.app/v1/league/$L/losers_bracket"   | jq '.'
curl -s "https://api.sleeper.app/v1/league/$L/rosters"          | jq '.[0].metadata.record'
```

Confirm, and correct this plan where reality differs:

| Assumption                                                                      | Used for                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------- |
| `settings.playoff_week_start` exists                                            | Regular-season boundary                           |
| `settings.league_average_match` exists (0/1)                                    | Median era — _nice to have; 0a already covers it_ |
| Bracket entries carry `r`, `m`, `t1`, `t2`, `w`, `l`, `t1_from`, `t2_from`, `p` | Bracket storage + title-path classification       |
| `p` marks placement (1 = title game, 3 = third place)                           | Excluding consolation games                       |
| `t1`/`t2` are **roster ids**, matching `Team.rosterId`                          | Mapping bracket sides to members                  |

Save real responses as JSON fixtures under `test/fixtures/sleeper/`. The bracket
classifier is the riskiest pure function in this plan and should be tested
against real shapes, not invented ones.

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
only as a cross-check if 0b confirms it exists. **This half of Phase 1 therefore
has no API dependency and can proceed even if 0b is blocked.**

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
  matchupId Int   // Sleeper's `m`
  placement Int?  // Sleeper's `p`

  /// True only for the game that decides the bracket's title.
  isTitleGame Boolean @default(false)
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
5. The losers bracket gets the same treatment; its title game is the toilet
   bowl.

> **Confirm before building:** in Sleeper's losers bracket, whether the
> `p === 1` _winner_ is the toilet-bowl champion or the team that escaped it.
> This inverts a badge, so it needs a human answer, not an inference.

### Sync + backfill

- New `app/libs/bracket-sync.server.ts` exporting `syncLeagueBrackets(league)`,
  mapping Sleeper roster ids to `Team` via `Team.rosterId` scoped to the league.
- Admin action `resyncBrackets` looping all leagues `FIRST_YEAR`→current.
- Add bracket sync to `jobs/sync-leagues.ts` so it stays current automatically.

### Payoff beyond the profile

Add `getPlayoffRecords()` to `app/models/records.server.ts` — most
championships, most playoff appearances, most toilet bowls — and render it on
`/leagues/records`, which today can only count Cup titles.

---

## Phase 3 — Profile data layer

New directory `app/models/profile/`. Every function takes a `userId`, returns a
plain typed shape, and leaks no Prisma types. **That boundary is the whole
point** — it is what lets these swap to materialized summary tables later
without touching a single route.

| File                                                                                                                                                 | Exports                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `shared.server.ts`                                                                                                                                   | `pairTeamGames()`, `resolveCanonicalUser()`, shared types                      |
| `summary.server.ts`                                                                                                                                  | `getProfileSummary(userId)` — hero tiles + badges                              |
| `league.server.ts`                                                                                                                                   | `getLeagueProfile(userId)` — tier table, season history, game log, splits, H2H |
| `cup.server.ts`                                                                                                                                      | `getCupProfile(userId)`                                                        |
| `d12.server.ts`, `qbStreaming.server.ts`, `spreadPool.server.ts`, `locks.server.ts`, `dfsSurvivor.server.ts`, `fSquared.server.ts`, `omni.server.ts` | one `get<Contest>Profile(userId)` each                                         |

**Extract, don't duplicate.** The matchup-pairing logic currently inline at
`app/models/records.server.ts:512-560` (grouping `TeamGame`s by
`leagueId:week:sleeperMatchupId`) becomes `pairTeamGames()` in
`shared.server.ts`, and `getStreakRecords` is refactored to call it. Same for
the career aggregation at `records.server.ts:17`.

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
await authenticator.isAuthenticated(request, { failureRedirect: "/login" });
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
| Median-era guard             | Pre-median league produces zeroed median values, not garbage                                                       |
| `pairTeamGames()`            | Unpaired games skipped, ties handled — guard the `records.server.ts` refactor                                      |
| Badge derivation             | Thresholds fire exactly at the boundary                                                                            |
| Tier movement                | Promotion/relegation across a gap year                                                                             |
| `isRegularSeason` resolution | Uses `playoffWeekStart`; falls back correctly when null                                                            |

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

3. **Toilet bowl semantics need a human answer** (see Phase 2).

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
