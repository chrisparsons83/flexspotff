# User Profile — Design Plan

## Context

FlexSpotFF has eight seasons of history (2018–2025) across ten distinct
contests, but there is **no user profile page**. Member data is scattered:
standings show one season, the Record Books show top-50 leaderboards, each side
game has its own standings page. There is no way to answer "who is this person,
and what have they done here?"

The goal is a LearnedLeague-style profile: a dense, statistics-heavy page per
member, viewable by any logged-in member. This document is the **design plan** —
information architecture and data strategy. It is deliberately not an
implementation document; that comes after we iterate on this.

## Decisions locked in

| Question            | Decision                                                             |
| ------------------- | -------------------------------------------------------------------- |
| Scope               | Everything unified — all contests on one profile                     |
| Visibility          | Members only (must be logged in via Discord)                         |
| Editable bio fields | None. Discord name + avatar only; everything else derived            |
| Page shape          | Persistent hero + tab bar                                            |
| Hero contents       | Career headline numbers + derived badges row                         |
| Tab organization    | **By contest** (one tab per game)                                    |
| Player-level stats  | Out of scope — no starter/roster aggregation                         |
| Badges              | Derived on the fly, no new schema                                    |
| Record math         | Median era must be **detected from data**, never hardcoded           |
| Playoffs            | New bracket storage + Sleeper sync; title path + toilet bowl count   |
| Backfill            | All the way to 2018                                                  |
| Head-to-head        | **Redraft league matches only** — no Cup, no side games              |
| Performance         | Compute live per tab, structured so it can migrate to summary tables |
| Discovery           | Member names link from existing tables + "My Profile" in nav         |
| Tab mechanics       | Nested routes (`/members/$userId/league`), one loader per tab        |
| Sequencing          | One effort — brackets and profile ship together                      |

## Data inventory

What actually exists per contest, and therefore what a profile can show.

| Contest             | Models                                                      | Per-member data available                                               | Notes                                                                                          |
| ------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Redraft league**  | `League`, `Team`, `TeamGame`                                | Season W/L/T, median W/L/T, PF/PA, draft position, per-week score, tier | The core. `League.tier` 1–5 = Champions / Admiral / Dragon / Galaxy / Monarch, 12 members each |
| **Cup**             | `Cup`, `CupTeam`, `CupGame`                                 | Seed, bracket run, titles, finals appearances                           | Already aggregated in `records.server.ts:330`                                                  |
| **D12**             | `D12Season`, `D12League`, `D12WeekScore`, `D12DraftPick`    | Weekly points, draft picks                                              | 2025+ only                                                                                     |
| **QB Streaming**    | `QBStreamingWeek`, `QBSelection`, `QBStreamingWeekOption`   | Standard + deep QB picks and points per week                            |                                                                                                |
| **Spread Pool**     | `PoolWeek`, `PoolGame`, `PoolGamePick`, `PoolWeekMissed`    | Bet amounts, W/T/L, net won/lost, missed weeks (−20 penalty)            | Only contest with a bankroll concept                                                           |
| **Locks Challenge** | `LocksWeek`, `LocksGame`, `LocksGamePick`                   | W/T/L per pick, active picks                                            |                                                                                                |
| **DFS Survivor**    | `DFSSurvivorUserYear/Week/Entry`                            | Season points, weekly lineups by position slot, per-player points       |                                                                                                |
| **F²**              | `FSquaredEntry` → `Team[]`                                  | Which teams you picked each year, and how they did                      |                                                                                                |
| **Omni**            | `OmniSeason`, `OmniUserTeam`, `OmniDraftPick`, `OmniPlayer` | Drafted athletes across sports, points                                  | 2025 only                                                                                      |
| **Podcast**         | `Episode.author`                                            | Episodes hosted                                                         | Fun badge material                                                                             |
| ~~Survivor~~        | —                                                           | **None.** `games.survivor.tsx` is a bare external Sleeper link          | Excluded                                                                                       |

Two structural facts worth calling out:

- **Head-to-head opponents are derivable, not stored.** Pairing `TeamGame`s on
  `leagueId:week:sleeperMatchupId` yields both sides of a matchup. This is
  already done in `app/models/records.server.ts:512-560` and is the primitive
  for the game log and H2H.
- **`User` carries only Discord identity.** No profile fields exist, which
  matches the "nothing editable" decision — no migration needed for identity.

## Groundwork

Two pieces of data work are part of this same effort. Both are prerequisites for
the profile being correct, and both have value beyond it.

### 1. Data-driven season structure (blocks correct record math)

`app/libs/syncs.server.ts:283` currently hardcodes:

```ts
const isRegularSeason = week <= 13 || (week === 14 && year >= 2021);
```

This will break again when the regular season moves to 14→15 weeks, and it tells
us nothing about when median scoring started. The fix is to sync the league's
own settings from Sleeper's `GET /v1/league/{id}` endpoint and store them on
`League`:

- `playoff_week_start` → regular season is `week < playoffWeekStart`
- `league_average_match` → whether median games counted that year, per league

That makes both the regular-season boundary and the median era **self-describing
per league per year**, which also correctly handles the case where tiers differ
in the same season. `syncLeague` in `app/libs/league-sync.server.ts:22` already
fetches rosters and drafts; this adds one more fetch to the same function.

> ⚠️ **Verify first.** Network egress to `api.sleeper.app` is blocked from this
> environment, so I could not confirm those exact field names. Step one of
> implementation is to hit the league endpoint for a real league ID (e.g.
> `335507311525122048`, which appears in `league-sync.server.ts:41`) and confirm
> the settings keys before designing around them.

### 2. Playoff brackets (blocks championships, playoff records, toilet bowl)

Nothing about playoffs is stored today beyond the `isRegularSeason` flag on
`TeamGame`. Sleeper exposes `/winners_bracket` and `/losers_bracket` per league.
Each entry is expected to carry round, the two roster ids, winner/loser, where
each side came from, and a **placement marker** distinguishing the title game
from a 3rd-place game — which is exactly the distinction you asked for.

Scope for this piece:

- New model(s) to store bracket games, keyed to `League` and `Team`, recording
  round, bracket type (winners/losers), placement, and the two sides + result.
- Sync function alongside `syncLeague`, plus a backfill pass over every league
  2018–present.
- Classification rule: a game counts toward the **playoff record** only if it is
  on the path to the title. 3rd-place, 7th-place, and other placement games are
  stored and shown in the game log with their round label, but excluded from the
  record.
- The losers bracket's terminal game produces a **toilet bowl title**, tracked
  as its own labeled honor.

This ships as part of the same effort as the profile, so the page launches with
real championship and playoff history rather than stubs. It also fixes the
Record Books page, which today can only count Cup championships.

## Page architecture

Nested routes under `/members/$userId`, gated on an authenticated session. The
parent route renders the hero and the tab bar; each child route is one contest
with its own loader, so opening a profile queries one contest, and every tab is
deep-linkable.

```
/members/$userId              → redirects to /league
/members/$userId/league       → the deep one
/members/$userId/cup
/members/$userId/d12
/members/$userId/qb-streaming
/members/$userId/spread-pool
/members/$userId/locks
/members/$userId/dfs-survivor
/members/$userId/f-squared
/members/$userId/omni
```

```
┌──────────────────────────────────────────────────────────────┐
│  HERO (always visible)                                       │
│  ┌────────┐  DiscordName                                     │
│  │ avatar │  member since · seasons played · current league   │
│  └────────┘                                                  │
│                                                              │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐         │
│  │ Seasons │ Career  │  Win %  │ Career  │  Titles │  ← headline tiles
│  │    8    │148-92-3 │  .616   │  PF     │    2    │         │
│  └─────────┴─────────┴─────────┴─────────┴─────────┘         │
│                                                              │
│  🏆 Cup Champion ×2   👑 Champions ×3   🚽 Toilet Bowl ×1     │  ← derived badges
│  🎙 Podcast Host   📈 200-Pt Week   🔥 8-Game Streak          │
├──────────────────────────────────────────────────────────────┤
│ League │ Cup │ D12 │ QB │ Spread │ Locks │ DFS │ F² │ Omni    │  ← tabs, by contest
└──────────────────────────────────────────────────────────────┘
```

Headline tiles are cross-contest career totals. Badges are the ribbon analog.
Everything else lives in its contest's tab.

## Per-tab content

### League (the deep one)

- **Career by tier** — the closest analog to LearnedLeague's Rundle table: one
  row per tier (Champions / Admiral / Dragon / Galaxy / Monarch) with record,
  win %, PF/PA.
- **Season history** — one row per season: year, league + tier, final rank,
  record, median record, PF, PA, draft position, playoff result. Tier movement
  shown as promotion/relegation arrows season over season.
- **Game log** — every matchup ever: year, week, opponent (linked to their
  profile), score, result, round label for playoff games.
- **Splits** — best/worst week, avg PF by season, points-per-week distribution,
  record in close games, record vs the weekly median.
- **Head-to-head** — career series vs each opponent from league matches only:
  record, avg score, biggest win/loss, and which seasons you shared a league.
  Cup meetings and side games are deliberately excluded. _(Assumption to
  confirm: league playoff games count toward H2H alongside regular-season
  games.)_

Median record is shown as its own column and only summed into a combined record
for seasons where the league's synced settings say median games counted. Seasons
before that show H2H record only, with a footnote — no fake combined numbers.

### Cup

Bracket runs by year, seed history, titles, finals appearances, and career cup
game record. Reuses the aggregation in `records.server.ts:330`. No H2H here —
that's league-only by design.

### Each side game

Consistent shape per tab so they read alike: seasons participated, career
finish/points, per-season table, and one or two game-specific highlights —

- **D12** — weekly points, best week, draft picks by year
- **QB Streaming** — standard vs deep points, best/worst weekly pick,
  most-picked QB
- **Spread Pool** — net won/lost, W/T/L, ROI, biggest bet, weeks missed
- **Locks** — W/T/L, win %, best week
- **DFS Survivor** — season points and rank, weekly lineups, best week
- **F²** — teams picked each year and how they finished
- **Omni** — drafted athletes by sport, points contributed

A tab renders an empty state ("hasn't played D12") rather than disappearing, so
the tab bar is stable across profiles.

## Badge catalog (all derived)

| Badge                      | Source                                          |
| -------------------------- | ----------------------------------------------- |
| Seasons Played ×N          | count of `Team` rows                            |
| League Champion ×N         | winners bracket — _depends on groundwork 2_     |
| Toilet Bowl ×N             | losers bracket — _depends on groundwork 2_      |
| Cup Champion / Finalist ×N | `CupGame` — available today                     |
| Champions League ×N        | seasons in `League.tier === 1`                  |
| Climber                    | promoted a tier between seasons                 |
| 200-Point Week             | any `TeamGame.pointsScored >= 200`              |
| Streak honors              | longest win streak ≥ N, via `getStreakRecords`  |
| Iron Man                   | played every season since their first           |
| Record Book                | appears in the top 10 of any Record Books table |
| Podcast Host               | has `Episode` rows                              |
| Multi-Sport                | participated in N distinct contests             |

Thresholds are placeholders for the next iteration.

## Performance strategy

Each tab is its own nested route with its own loader, so opening a profile costs
one contest's queries rather than all ten. Every aggregation goes in a
`app/models/profile/*.server.ts` module behind a function that takes `userId`
and returns a plain typed shape — never inline in a route. That boundary is what
makes a later swap to materialized summary tables a change of implementation
inside those functions rather than a rewrite of the pages.

The hero's cross-contest headline numbers and badges are the one thing the
parent route must load on every view, so they are the first candidates for
caching or materializing if this turns out to be too heavy. Keeping them behind
a single `getProfileSummary(userId)` function means that swap touches one place.

## Discovery

- Member names become links to `/members/$userId` across standings, leaderboard,
  records, cup bracket, and side-game standings. `LeagueTable.tsx` and
  `LeaderboardRow.tsx` are the highest-traffic starting points.
- "My Profile" link in the header/user menu.

## Open questions for iteration 2

1. **Badge thresholds** — what point total earns a badge, how long a streak, how
   many contests makes you Multi-Sport. Needs a pass against real data so badges
   are rare enough to mean something.
2. **Do league playoff games count toward H2H?** Assumed yes above, since
   they're league matches, but worth a yes/no.
3. **Merged accounts** — `User.mergedInto` tombstones exist. A profile URL for a
   merged-away account should presumably redirect to the canonical member.
4. **Members who predate a contest** — e.g. someone who left before D12 existed.
   Empty state wording per tab.
5. **Does the hero's "Titles" tile count league titles only, or league + Cup?**
6. **Sleeper league coverage for backfill** — whether every 2018–2020 league
   still resolves. Determines how much of the bracket history we actually
   recover.

## Next steps

This iteration produces no code — it's the design frame, not an implementation
document. Before the next iteration:

1. **Confirm the Sleeper API shapes against the live API.** Egress was blocked
   from this environment, so the settings keys (`playoff_week_start`,
   `league_average_match`) and the bracket entry shape are from knowledge, not
   observation. Everything in the Groundwork section rests on them, so this is
   the first thing to verify — and it can be done from any machine with network
   access by fetching `https://api.sleeper.app/v1/league/335507311525122048` and
   its `/winners_bracket`.
2. **Spot-check bracket coverage for 2018–2020**, which determines how much
   career championship history we can actually recover.
3. **Resolve the open questions above**, particularly badge thresholds.

Then iteration 3 turns this into an implementation document with concrete
schema, function signatures, and file-by-file work.
