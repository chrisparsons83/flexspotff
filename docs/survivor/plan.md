# Survivor — Plan

Issue: [#182](https://github.com/chrisparsons83/flexspotff/issues/182)

## Context

Survivor is the NFL pick-one-team-a-week pool: pick a team to win, never the
same team twice, and a loss (or a missed pick) knocks you out. The last one
standing wins. When everyone is out early, a new pool starts the following week,
so a season can hold several pools, one after another and never two at once.

The pools ran on Yahoo (Survival Football) and moved to Sleeper (Pick'em,
Survivor type) in 2024. Today the site only has `/games/survivor`, a hardcoded
join link for 2025. This plan adds the history, keeps the current Sleeper pool
synced, and adds a Survivor tab on member profiles.

## Decisions locked in

| Question       | Decision                                                                               |
| -------------- | -------------------------------------------------------------------------------------- |
| Visibility     | Members only, like Guillotine                                                          |
| Winner         | Whoever lasted longest; entries that went out the same week (or all survived) share it |
| Yahoo pools    | 2022 and 2023, all five Flex Spot groups. The 2019 group was a trivia group, not ours  |
| Yahoo backfill | Read once with Chris's session cookie, saved as `app/libs/survivor/yahoo-history.json` |
| Sleeper pools  | Added by URL or invite link in the admin; this season's pools sync hourly              |

## Phase 0 — What the sources return (checked 2026-10-06)

### Sleeper: everything is on the public API

A Survivor pool is an ordinary Sleeper league with `sport: "pickem:nfl"` and
`settings.pickem_type: 1`. No auth needed:

- `GET /v1/user/<id>/leagues/pickem:nfl/<season>` lists a member's pools. The
  commissioner's account (`202517573990879232`) finds all of them.
- `GET /v1/league/<id>/users` gives the Sleeper user per entrant.
- `GET /v1/league/<id>/rosters` gives one roster per entry, and its `metadata`
  holds the whole story:
  - `previous_picks`: `{ "v1:regular:<week>": ["DEN"] }`, every pick by week
  - `is_eliminated`: `"true"` / `"false"`
  - the week it went out, in one of two shapes:
    - 2024: `eliminated_leg_id: "v1:regular:<week>"` (plus `num_eliminations`)
    - 2025 on: `lost_leg_ids: ["v1:regular:<week>"]`

A missed pick shows as elimination the week after the last pick (e.g. picks
through week 4, `eliminated_leg_id` week 5). Some rosters have no owner (the
player left the pool). `num_revives_allowed` is 0 in every pool.

| League ID             | Name                             | Season | Entries | Weeks | Result                               |
| --------------------- | -------------------------------- | ------ | ------- | ----- | ------------------------------------ |
| `1136544991536537600` | FlexSpot FF                      | 2024   | 31      | 1–5   | Everyone out; last one out in week 5 |
| `1147066836232556544` | Flexspot FF 2: Electric Boogaloo | 2024   | 26      | 5–18  | 3 alive at the end of week 18        |
| `1268832608276447232` | FlexSpot 2025 Part 1 of X        | 2025   | 32      | 1–18  | CodeMonkey, sole survivor            |
| `1402774715063406592` | FlexSpot 2026 Part 1 of X        | 2026   | 17      | 1–    | In season (5 alive after week 4)     |

40 of the 41 Sleeper users across these pools already map to a member through
`SleeperUser`.

### Yahoo: the history exists, behind a login

Yahoo Survival Football is game code `nfls`. The public profile lists Chris's
pools only as "Private League" with a size, and archived group pages
(`football.fantasysports.yahoo.com/<year>/survival/...`) all fall back to a
"season is over" page. What does work is the cookie-authenticated mirror of the
Fantasy API that Yahoo's own pages use, `pub-api-ro.fantasysports.yahoo.com`:

- `users;use_login=1/games;game_codes=nfls;seasons=.../teams` lists every group
  the logged-in account entered: game keys 394 (2019), 416 (2022) and 426
  (2023).
- `group/<key>/teams;out=week_picks` gives each entry's manager (nickname and
  `guid`), `status` (`done` for the winner, `dead`), `elimination_week`, and
  every week's pick as `nfl.t.<id>` with `correct` or `strike`.

The official API (`fantasysports.yahooapis.com`) wants OAuth and has no survival
resources, so this is a one-off read, not a sync. As commissioner the API also
returns managers' email addresses; they are dropped and never stored.

| Group key     | Name                     | Season | Entries | Weeks | Winner   |
| ------------- | ------------------------ | ------ | ------- | ----- | -------- |
| `416.g.6184`  | Flex Spot FF             | 2022   | 25      | 1–3   | Mike     |
| `416.g.35078` | FlexSpotFF Redemption    | 2022   | 19      | 4–8   | Noro     |
| `416.g.37779` | FlexSpot FF Survivor III | 2022   | 15      | 9–17  | Nicholas |
| `426.g.24316` | Flex Spot FF             | 2023   | 28      | 1–10  | Arsh     |
| `426.g.35907` | FlexSpotFF Redemption    | 2023   | 14      | 9–14  | Chris    |

Left out: Yahoo's public contest each year (`416.g.485`, `426.g.30463`) and
2019's "Sports Trivia Face-Off Fans". Nothing exists for 2020–2021.

Yahoo's team IDs map to the usual abbreviations (1 ATL … 34 HOU, with 33 BAL).
All 267 Yahoo picks and all 429 Sleeper picks agree with the scores in
`NFLGame`, and ranking on how far entries got crowns Yahoo's own winner, alone,
in every Yahoo pool (tested in `standings.test.ts`).

A `guid` is Yahoo's stable account ID, so one link per account covers every pool
it played. Five entries have their `guid` hidden (`--`, a closed account) and
are assigned by hand.

### Sleeper quirk: the last one standing is never knocked out

The 2025 winner picked Dallas in week 18, Dallas lost, and Sleeper left him
alive with 0 points for the week. Once a pool is complete, a pick that scored 0
is a loss whether or not Sleeper eliminated anyone.

## What was built

```
SurvivorPool    year, name, source (SLEEPER | YAHOO), externalId, startWeek,
                inviteUrl, isComplete, lastSyncedAt
SurvivorEntry   pool, displayName, entryName (Yahoo pick set), sleeperOwnerId |
                yahooGuid, userId, eliminatedWeek, survivedWeek, finish
SurvivorPick    entry, week, team (NFLTeam.sleeperId), result (WIN | LOSS | PENDING)
YahooUser       yahooGuid -> member, as SleeperUser is for Sleeper
```

- A missed pick is an elimination week with no pick in it.
- `survivedWeek` is the last week the entry picked a winner; places rank on it,
  so late joiners and no-pick entries rank fairly.
- A pool is decided when its source says so or at most one entry is alive.
  Finishes are only written then.

**Admin** (`/admin/survivor`): add a Sleeper pool by league URL or invite link,
load or reload the Yahoo pools from the bundled file, sync, delete, match Yahoo
accounts (suggested from members' Sleeper handles found in pick set names), and
per pool: match Sleeper or Yahoo accounts, assign ownerless entries by hand, and
set the invite link.

**Games** (`/games/survivor`, members only): pools by season with winners, the
running pool's join link, an all-time table; each pool has a week-by-week
summary and the full pick board.

**Profile**: a Survivor tab (career, by pool, pick log, teams picked), and a
"Survivor Champion" ribbon counting pools won.

**Sync**: `sync-survivor`, hourly at :50, resyncs every Sleeper pool of the
current season.
