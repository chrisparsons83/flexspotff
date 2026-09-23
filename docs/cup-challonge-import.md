# Importing a Cup from Challonge

The 2021 Cup was run on Challonge (https://challonge.com/2021FSCup), before the
site ran cups itself. `/admin/cups/<id>` can import a finished Challonge bracket
into a cup, keeping Challonge's seeds, pairings and winners. Scores shown on
`/leagues/cup/<year>` still come from `TeamGame`.

Importing replaces the cup's teams and games, so it is safe to run again.

## Steps for 2021

1. `/admin/cups`: pick **2021** and click **Create Cup**.
2. **Administer** the new cup and map its weeks, then click **Update Mapping**.

   | Weeks | Mapping       |
   | ----- | ------------- |
   | 1–5   | Seeding Week  |
   | 6     | Round of 64   |
   | 7     | Round of 32   |
   | 8     | Round of 16   |
   | 9–10  | Quarterfinals |
   | 11–12 | Semifinals    |
   | 13–14 | Finals        |

3. Under **Import from Challonge**, keep the slug `2021FSCup` and click
   **Preview Import**. Nothing is written yet. Expect:
   - all 60 participants matched
   - 4 seeded differently: 13/14 and 18/19, which are fractions of a point apart
     on the site's numbers
   - 11 score differences
   - one result the site would have decided differently: Round 2, Eli beat Jay
     Enn 95–89 on Challonge, while the site has 88.98–89.26
   - no errors
4. Click **Import**.

Don't use **Set Seeds** or **Score Week** on an imported cup. They rebuild it
from the site's scores and would undo Challonge's results.

## How participants are matched

Challonge only has the Discord names from 2021, and about half have changed
since. Each participant is matched to the team whose seeding-week rank and round
scores agree with Challonge. Challonge stores truncated whole numbers. Name
similarity only breaks ties.

The import refuses to write if:

- a participant's seed is more than 3 places from the team's rank on the site
- none of a participant's scores are within 5 points of the matched team's
- Challonge's pairings don't fit the site's bracket, for example because seeds
  were edited on Challonge

The first two usually mean the weeks are mapped wrong. All three are checked
before anything is deleted, and they show up in Preview too.

## Checking it

```sql
SELECT
  (SELECT count(*) FROM "CupTeam" ct JOIN "Cup" c ON c.id = ct."cupId" WHERE c.year = 2021) AS teams,
  (SELECT count(*) FROM "CupGame" cg JOIN "Cup" c ON c.id = cg."cupId" WHERE c.year = 2021) AS games,
  (SELECT count(*) FROM "CupGame" cg JOIN "Cup" c ON c.id = cg."cupId"
     WHERE c.year = 2021 AND NOT cg."containsBye" AND cg."winningTeamId" IS NULL) AS unplayed;
```

Expect `60 | 63 | 0`. `/leagues/cup/2021` should show Tager beating Jom in the
final.
