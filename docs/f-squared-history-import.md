# Importing old F² seasons from Google Sheets

F² ran in Google Sheets from 2019 to 2021, and on the site from 2022.
`/admin/f-squared/import` imports a sheet's season into the same tables the site
uses. Once imported, the season shows up on `/games/f-squared/standings/<year>`
(and in the **Choose Year** menu on `/games/f-squared`), on members' F² profile
tabs, and in their F² title badges.

| Year | Sheet                                                                               | Picks tab                 |
| ---- | ----------------------------------------------------------------------------------- | ------------------------- |
| 2019 | https://docs.google.com/spreadsheets/d/1LTgafHLhuTlXal8tJbPAiFZP-sotWkH7Pj_dvOK6k5U | Pick Data                 |
| 2020 | https://docs.google.com/spreadsheets/d/1ISYKNUyDTDElPRuaf-eI7NPbjGZcgKbmflai19STJJ0 | Form Responses Normalized |
| 2021 | https://docs.google.com/spreadsheets/d/15OOuKB6Bo0qzJLlNEwQld5He0PWCwiR7iOaO7NkM0Ro | Form Responses Normalized |

The import reads two tabs, found by name. Both picks tabs are hidden in the
sheets, but they can still be read:

- **The picks tab** has one row per pick: `Drafter, Pick, Points` in 2019, and
  `Manager, Pick, Points, League` after. "Drafter"/"Manager" is the entrant.
  "Pick" is the picked team, named after its manager. The `CONSENSUS` (2021) and
  `Perfect Lineup` (2020) rows are skipped.
- **Fantasy Team Scores** lists every team in every league with its weekly
  scores. The 2019 sheet calls the Champions league `CL`.

Google returns the sheet's first tab when a tab name doesn't exist. The import
checks each tab's columns, so a mistyped name gives an error instead of a bad
import.

## How picks become site teams

The leagues and teams for these years are already on the site, so an entry is
just a link to the teams it picked. The sheets name teams by their manager's
nickname, which isn't enough to identify the site team, so the import uses
scores instead:

1. Each **Fantasy Team Scores** row is matched to the site team in its league
   whose weekly scores are closest. Real matches are at most 25 points apart
   over a season. These are Sleeper stat corrections made after the sheet was
   scored. The next closest team is always more than 150 points away. The page
   refuses anything more than 60 points off.
2. Each **pick** is matched to the team with its points in its league. In 2019,
   Bakron (Admiral) and Eddie127 (Dragon) both finished on 1383.24, and the 2019
   sheet gives no league, so the name decides.

Entries are scored with the site's points for each team, not the sheet's, so
totals can differ from the sheet by a few points. The winner is the same in all
three years.

## Names

Entrant names are matched to members once and saved as `MemberAlias` rows,
shared with the QB streaming import (see `docs/qb-streaming-history-import.md`).
Most entrants also played in the leagues under the same name, so a name is
suggested as the member who managed that team, even when their Discord name
looks nothing like it (e.g. `Jad` is slimarabia and `tc216997` is Tee Cee).
Names that don't match a team fall back to members with similar names.

In a trial run of all three years against a copy of the dev database, every name
got a suggestion except `moose#0017` (2019), who managed no team that year. That
is almost certainly tHEmOOSE 💎, so match them by hand. Look over the
suggestions before pressing **Match**, as always.

## Steps

1. Open `/admin/f-squared/import`. Pick the year; the sheet link and tab names
   fill in by themselves. Click **Preview**.
2. Work through **Names**: **Match** each name, or click **Create stub member**
   for someone who never joined the site.
3. Check that **Teams that could not be matched** doesn't appear. **Teams**
   lists every match, for a look.
4. Click **Import**. Re-running replaces that year. Years from 2022 on are
   refused.
5. Compare **Entries** with the sheet's leaderboard. The **Sheet** column is the
   sheet's own total.
