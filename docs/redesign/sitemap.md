# Sitemap and navigation

Part of #190, under #189. This is the structure the redesign builds to. Route
changes (#195) start once it is agreed.

## Principles

- Three sections, named by what they are to a member: **Leagues**, **Side
  leagues** and **Games**.
- URLs follow the sections. A page's address tells you where it sits in the nav.
- Anything without a year in the URL means the current season. Years appear only
  when you are looking at a past one.
- Nothing that has been shared in Discord breaks. Every moved URL gets a
  permanent redirect.
- Profiles (`/u/:handle` and its tabs) keep their structure and content. They
  are restyled, not reorganised.
- Admin URLs stay where they are. Admin is reorganised through its navigation
  and a new home page, not by moving routes.

## Primary navigation

| Position | Item         | Goes to         | Notes                                                  |
| -------- | ------------ | --------------- | ------------------------------------------------------ |
| Left     | Logo         | `/`             | Home. There is no separate Home item.                  |
| Main     | Leagues      | `/leagues`      |                                                        |
| Main     | Side leagues | `/side-leagues` |                                                        |
| Main     | Games        | `/games`        |                                                        |
| Right    | Account menu |                 | Signed in: Dashboard, Profile, Admin (admins), Log out |
| Right    | Log in       | `/login`        | Signed out, in place of the account menu               |

The theme toggle (System, Dark, Light) sits on the right side.

On mobile, the three sections and the account items collapse into one menu
button. The menu lists the three sections first, then the account items.

The current section is marked in the nav on every page inside it, not only on
the section's landing page.

### Footer

- Discord invite
- Podcast archive (`/podcast`)

### Leaving the nav

- **Podcast.** No new episodes are being made. The page stays as an archive,
  linked from the footer, and the RSS feed at `/rss/trash-turtle-football.xml`
  stays live for anyone still subscribed. Episode data is kept.
- **Omni.** Omni now runs on Brackt. Past seasons move into Games as an archive.
- **Dashboard.** Moves to the account menu and becomes each member's own page
  for the week. See [Dashboard](#dashboard).

### Not linked from the nav

- `/badges`: members only, linked from every profile, as today.
- `/in-a-dingy-corner-of-the-internet-is-a-message-board`: an old meme page,
  kept where it is and unlinked.

## Leagues

The promotion and relegation leagues, the cup, and everything that spans them.
Mostly as today, plus a page for each league.

### Section pages

| Page              | URL                                  | Today                                               |
| ----------------- | ------------------------------------ | --------------------------------------------------- |
| Overview          | `/leagues`                           | New. This season's five leagues and the week.       |
| League            | `/leagues/:year/:league`             | New. See below.                                     |
| Standings         | `/leagues/standings`                 | Same URL                                            |
| Standings, past   | `/leagues/standings/:year`           | Same URL                                            |
| Leaderboard       | `/leagues/leaderboard`               | Same URL                                            |
| Leaderboard, past | `/leagues/leaderboard/:year`         | Same URL                                            |
| Leaderboard, week | `/leagues/leaderboard/:year/:week`   | Same URL                                            |
| Cup               | `/leagues/cup`                       | No page of its own today; now shows the current cup |
| Cup, past         | `/leagues/cup/:year`                 | Same URL                                            |
| Records           | `/leagues/records`                   | Same URL                                            |
| ADP               | `/leagues/adp`, `/leagues/adp/:year` | Same URL                                            |
| Rules             | `/leagues/rules`                     | Same URL                                            |

Sub-navigation: Overview, Standings, Leaderboard, Cup, Records, ADP, Rules, plus
a picker for the five leagues this season.

### League pages

`/leagues/:year/:league`, where `:league` is the league name in lower case
(`/leagues/2026/admiral`). Each league page has its own tabs:

| Tab          | URL suffix                     | Data today                                 |
| ------------ | ------------------------------ | ------------------------------------------ |
| Standings    | (none)                         | `Team`, `TeamGame`                         |
| Matchups     | `/matchups`, `/matchups/:week` | `TeamGame` (scores and starters)           |
| Playoffs     | `/playoffs`                    | `PlayoffGame` (winners and sacko brackets) |
| Draft        | `/draft`                       | `DraftPick`                                |
| Transactions | `/transactions`                | `WaiverTransaction` (waivers only)         |

A league's page also links to the same league in other years, as far back as the
data goes.

The fuller Sleeper data (trades, free-agent adds, and filling in past seasons)
is new feature work, so it is tracked as its own issue rather than inside the
redesign. This sitemap only reserves the tabs. A tab ships in #195 if its data
is already there, and the rest arrive with that issue.

## Side leagues

Separate fantasy leagues with their own drafts and rosters, run alongside the
main ones.

| Side league   | Section URL                | Today               |
| ------------- | -------------------------- | ------------------- |
| Guillotine    | `/side-leagues/guillotine` | `/games/guillotine` |
| D12           | `/side-leagues/d12`        | `/games/d12`        |
| Autodraft BBM | `/side-leagues/best-ball`  | `/games/best-ball`  |

`/side-leagues` is an overview of the three, with this season's leagues for
each.

### One shape for every side league

Each has seasons, each season can have several leagues, and each league has
standings and a draft. The shared sub-navigation is:

| Tab       | Guillotine                         | D12                    | Autodraft BBM              |
| --------- | ---------------------------------- | ---------------------- | -------------------------- |
| Standings | `/guillotine/:leagueId`            | `/d12/:year`           | `/best-ball/:year`         |
| Weeks     | `/guillotine/:leagueId/week/:week` | `/d12/:year/:week`     |                            |
| Draft     | `/guillotine/:leagueId/draft`      | `/d12/adp/:year` (ADP) | `/best-ball/:year/draft`   |
| Waivers   | `/guillotine/:leagueId/waivers`    |                        |                            |
| History   | `/guillotine` (all seasons)        | `/d12` (all seasons)   | `/best-ball` (all seasons) |

All paths in this table sit under `/side-leagues`. The D12 member page
(`/d12/:year/user/:userId`) moves with the rest.

Tabs a side league does not have are left out of its sub-navigation rather than
shown empty.

## Games

Everything else: pick'em, streaming and survivor games, plus the Omni archive.

| Game            | Section URL              | Today                   |
| --------------- | ------------------------ | ----------------------- |
| QB streaming    | `/games/qb-streaming`    | Same                    |
| Spread pool     | `/games/spread-pool`     | Same                    |
| Locks challenge | `/games/locks-challenge` | Same                    |
| DFS survivor    | `/games/dfs-survivor`    | Same                    |
| F²              | `/games/f-squared`       | Same                    |
| Survivor        | `/games/survivor`        | Same                    |
| Omni (archive)  | `/games/omni`            | `/omni-league`, `/omni` |

`/games` is an overview: each game, where this week stands, and a link to your
entry if you are signed in.

### One shape for every game

| Tab        | URL suffix               | Notes                                           |
| ---------- | ------------------------ | ----------------------------------------------- |
| Overview   | (none)                   | This week and the current standings at a glance |
| Standings  | `/standings`             | Current season, overall                         |
|            | `/standings/:year`       | A past season, overall                          |
|            | `/standings/:year/:week` | One week                                        |
| My entries | `/entries`               | Signed in only                                  |
| Rules      | `/rules`                 |                                                 |
| History    | `/history`               | Past seasons and all-time results               |

How each game fits:

- **QB streaming, spread pool, locks challenge, DFS survivor** fit as they are.
  Their landing pages today only point at the sub-navigation; they become the
  overview.
- **F²** has no weekly standings. Its rules page was written in the content pass
  (#196). `my-entry` becomes `entries`.
- **Survivor** is organised by pool, not by week: the overview lists this
  season's pools, `/games/survivor/:poolId` is one pool, and History is the
  all-time table that is on today's index.
- **Omni** is read-only. `/games/omni` lists past seasons and links to Brackt
  for the current one. Each season sits at `/games/omni/:year` with Standings,
  Draft board, Qualifying points and Rules.

Nothing in Games or Side leagues hardcodes a year. The nav links that point at
2025 today (Omni) go away with the archive.

## Account

| Item         | URL                       | Today                                                                                     |
| ------------ | ------------------------- | ----------------------------------------------------------------------------------------- |
| Dashboard    | `/dashboard`              | Same URL. Today it is only registration                                                   |
| Registration | `/dashboard/registration` | The form that is `/dashboard` today, linked from the dashboard while registration is open |
| Profile      | `/me`                     | Same. Redirects to your `/u/:handle`, or to the dashboard if profiles are not open to you |
| Admin        | `/admin`                  | Same                                                                                      |
| Log out      | `/logout`                 | Same                                                                                      |

## Dashboard

Logging in lands here. Today login goes to `/me`, which opens your profile
(#185); `login` and `auth/:provider/callback` change to send you to `/dashboard`
instead, and `/me` stays as the shortcut to your own profile.

`/dashboard` is where a member checks in on the week: how they did last week and
what they still need to do this week, across everything they play. Profiles are
the long view of a member's history; the dashboard is now.

It lists only what the member is in this season, in the same order as the nav:
Leagues, Side leagues, then Games. Each row links to the page where the member
can see more or act.

| Section      | Last week                                  | This week                                               |
| ------------ | ------------------------------------------ | ------------------------------------------------------- |
| League       | Result and score of their matchup          | Their opponent                                          |
| Cup          | Result, if they were still in it           | Their cup game, or when they went out                   |
| Side leagues | Score and place in each league they are in | Guillotine: still alive or not                          |
| QB streaming | Points and place                           | Whether they have picked, and the deadline              |
| Spread pool  | Points and place                           | Whether they have picked, and the deadline              |
| Locks        | Points and place                           | Whether they have picked, and the deadline              |
| DFS survivor | Points and place                           | Whether they have entered, and the deadline             |
| Survivor     | Whether their entries survived             | Entries still alive                                     |
| F²           |                                            | Whether they have an entry, while entries are open      |
| Registration |                                            | Whether they are registered, while registration is open |

Anything the member still has to do this week comes first, above the results.
Which deadlines and statuses the data can actually give is to be confirmed game
by game when the page is built.

## Admin

Admin URLs stay as they are. What changes is the grouping in the admin
navigation, which today is by game, and a new admin home.

### Admin home

`/admin` today is only the navigation. It becomes a page that lists what needs
doing this week, each item linking to the page that does it. Candidates, to be
confirmed against what the data can tell us:

- The week's spread pool lines, QB streaming options or locks games are not set
  up yet.
- Waiver reports for this week have not been posted.
- A scheduled job failed since the last visit.
- Sleeper users are waiting to be matched to members.
- Registration is open: how many have signed up against the cap.

### Grouping by task

| Group          | Pages                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| This week      | Admin home, Spread pool weeks, QB streaming weeks, Locks challenge, DFS survivor, Waiver reports       |
| Season setup   | Seasons, Registration list, Draft slots, Leagues, Cups, D12, Guillotine, Autodraft BBM, Survivor pools |
| Members        | Members, Unmatched Sleeper users, Merge duplicates, Add members                                        |
| Syncs and data | Syncing, Scheduler, F² history import, Bot commands                                                    |
| Archive        | Omni scoring, Omni qualifying points, Omni players, Podcasts                                           |

Every admin route is in the appendix with its group.

## Redirects

Old URLs keep working through permanent (301) redirects, using the same thin
redirect route that `/members/*` uses today. A splat route at each old prefix
covers every page beneath it, so deep links shared in Discord land on the same
page at its new address.

| Old                                           | New                                          |
| --------------------------------------------- | -------------------------------------------- |
| `/games/guillotine/*`                         | `/side-leagues/guillotine/*`                 |
| `/games/d12/*`                                | `/side-leagues/d12/*`                        |
| `/games/best-ball/*`                          | `/side-leagues/best-ball/*`                  |
| `/games/f-squared/my-entry`                   | `/games/f-squared/entries`                   |
| `/omni-league`                                | `/games/omni`                                |
| `/omni-league/standings/:year`                | `/games/omni/:year`                          |
| `/omni-league/2025/rules`                     | `/games/omni/2025/rules`                     |
| `/omni-league/qualifying-points/:year/:sport` | `/games/omni/:year/qualifying-points/:sport` |
| `/omni/:year/board`                           | `/games/omni/:year/draft`                    |
| `/members/:userId/*`                          | `/u/:handle/*` (already in place)            |

Unchanged: everything under `/leagues`, `/u`, `/admin`, the four weekly games,
survivor, `/dashboard`, `/podcast`, the RSS feed, `/badges`, `/login`, `/logout`
and `/me`.

## Follow-up issues

- **League pages from Sleeper.** Trades and free-agent transactions, and filling
  in matchups, playoffs and drafts for past seasons back to `FIRST_YEAR` (2018)
  wherever Sleeper has them. Fills the League page tabs above.
- **Retire Omni admin.** Once the archive is read-only, the Omni scoring and
  player tools have nothing left to do.

## Appendix: every route

`Auth` is who can see it: anyone, members (signed in), or admins.

### Public

| Route today                                             | Auth    | New home                                                            |
| ------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| `/`                                                     | Anyone  | Home                                                                |
| `/leagues`                                              | Anyone  | Leagues overview (was layout only)                                  |
| `/leagues/standings/:year?`                             | Anyone  | Leagues, unchanged                                                  |
| `/leagues/leaderboard`                                  | Anyone  | Leagues, unchanged                                                  |
| `/leagues/leaderboard/:year`                            | Anyone  | Leagues, unchanged                                                  |
| `/leagues/leaderboard/:year/:week`                      | Anyone  | Leagues, unchanged                                                  |
| `/leagues/cup`, `/leagues/cup/:year`                    | Anyone  | Leagues, unchanged                                                  |
| `/leagues/records`                                      | Anyone  | Leagues, unchanged                                                  |
| `/leagues/adp/*`                                        | Anyone  | Leagues, unchanged                                                  |
| `/leagues/rules`                                        | Anyone  | Leagues, unchanged                                                  |
| `/games`                                                | Anyone  | Games overview (was layout only)                                    |
| `/games/qb-streaming/*`                                 | Mixed   | Games, unchanged                                                    |
| `/games/spread-pool/*`                                  | Mixed   | Games, unchanged                                                    |
| `/games/locks-challenge/*`                              | Mixed   | Games, unchanged                                                    |
| `/games/dfs-survivor/*`                                 | Mixed   | Games, unchanged                                                    |
| `/games/f-squared`, `/standings/:year`                  | Anyone  | Games, unchanged                                                    |
| `/games/f-squared/my-entry`                             | Members | `/games/f-squared/entries`                                          |
| `/games/survivor`, `/games/survivor/:poolId`            | Anyone  | Games, unchanged                                                    |
| `/games/guillotine/*`                                   | Anyone  | `/side-leagues/guillotine/*`                                        |
| `/games/d12/*`                                          | Anyone  | `/side-leagues/d12/*`                                               |
| `/games/best-ball/*`                                    | Anyone  | `/side-leagues/best-ball/*`                                         |
| `/omni-league`, `/omni-league/*`                        | Anyone  | `/games/omni/*`                                                     |
| `/omni/:year/board`                                     | Anyone  | `/games/omni/:year/draft`                                           |
| `/u/:handle/*`                                          | Members | Unchanged                                                           |
| `/me`                                                   | Members | Unchanged                                                           |
| `/members/*`                                            | Members | Unchanged (redirect to `/u/:handle`)                                |
| `/badges`                                               | Members | Unchanged, linked from profiles                                     |
| `/dashboard`                                            | Members | Dashboard; the registration form moves to `/dashboard/registration` |
| `/podcast`                                              | Anyone  | Unchanged, footer only                                              |
| `/rss/trash-turtle-football.xml`                        | Anyone  | Unchanged                                                           |
| `/in-a-dingy-corner-of-the-internet-is-a-message-board` | Anyone  | Unchanged, unlinked                                                 |
| `/login`, `/logout`, `/auth/:provider/*`                | Anyone  | Unchanged                                                           |
| `/resources/theme`                                      | Anyone  | Unchanged (theme toggle action)                                     |
| `/api/sync-week-scores`, `/healthcheck`                 | Machine | Unchanged                                                           |

### Admin

| Route                                     | Group          |
| ----------------------------------------- | -------------- |
| `/admin`                                  | Admin home     |
| `/admin/spread-pool`, `/:year/:week`      | This week      |
| `/admin/qb-streaming`, `/:id`             | This week      |
| `/admin/locks-challenge`                  | This week      |
| `/admin/dfs-survivor`                     | This week      |
| `/admin/waivers`                          | This week      |
| `/admin/season`, `/:id/sorting`           | Season setup   |
| `/admin/registration-list`                | Season setup   |
| `/admin/draft-slots`, `/new`, `/:id/edit` | Season setup   |
| `/admin/leagues`, `/new`                  | Season setup   |
| `/admin/cups`, `/:id`                     | Season setup   |
| `/admin/d12`, `/:seasonId`                | Season setup   |
| `/admin/guillotine`, `/:leagueId`         | Season setup   |
| `/admin/best-ball`, `/:leagueId`          | Season setup   |
| `/admin/survivor`, `/:poolId`             | Season setup   |
| `/admin/members`, `/:id`                  | Members        |
| `/admin/members/unmatched`                | Members        |
| `/admin/members/merge`                    | Members        |
| `/admin/members/add`                      | Members        |
| `/admin/data`                             | Syncs and data |
| `/admin/scheduler`                        | Syncs and data |
| `/admin/f-squared/import`                 | Syncs and data |
| `/admin/bot`                              | Syncs and data |
| `/admin/omni/scoring`                     | Archive        |
| `/admin/omni/qualifying-points`           | Archive        |
| `/admin/omni/add-player`                  | Archive        |
| `/admin/podcasts`, `/:id`                 | Archive        |
