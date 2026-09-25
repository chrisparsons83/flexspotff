# Importing old QB Streaming seasons from Google Sheets

QB Streaming ran in Google Sheets in 2020 and 2021, and on the site from 2022.
`/admin/qb-streaming/import` imports a sheet's season into the same tables the
site uses. Once imported, the season shows up on
`/games/qb-streaming/standings/<year>`, on the weekly standings, and on members'
profile tabs.

| Year | Sheet                                                                               |
| ---- | ----------------------------------------------------------------------------------- |
| 2020 | https://docs.google.com/spreadsheets/d/1q0Xjus1Wk_2aX2t8252U_4glALuQgcFEorj1OwZ_9BA |
| 2021 | https://docs.google.com/spreadsheets/d/1NpNDRic9wCvjesTRhXL6njKMlCG1PjTh8NM5nhhWnZE |

The import reads the **Data** tab (`gid=0`), which has one row per pick:
`Week, Player, Choice, Type, Fantasy Points`. "Player" is the manager. Rows from
the `CONSENSUS` manager are skipped.

- **Points** are the sheet's own numbers. Sleeper's stats are only used to find
  each quarterback and his game, and to list scores that differ from a Sleeper
  re-score. These are stat corrections of a few tenths.
- **Names** are matched once and saved as `MemberAlias` rows. The saved matches
  are reused by any later import, such as F² (#154), and move with a member when
  accounts are merged.
- **Stub members** are for people who never joined the site. They get a made-up
  Discord ID, `legacy:<name>`, and can't log in. If the person joins later,
  merge the stub into their real account at `/admin/members/merge`.
- **Re-running** an import replaces that year. Years from 2022 on are refused.

## Steps

1. Open `/admin/qb-streaming/import`. Pick the year; the sheet link fills in by
   itself. Click **Preview**.
2. Work through **Names**. Suggested members are pre-selected where exactly one
   member's name looks like the sheet's. **Match** each name, or click **Create
   stub member**. Several spellings of one person, such as `Apatel` and
   `apatel`, are shown as one row.
3. Once every name is matched, check **Entries that need a look**:
   - 2020 week 11: apatel78 has two Standard picks (Kirk Cousins, Tua) and two
     Deep picks (Jameis Winston, Alex Smith). The sheet counted all four. Choose
     one of each.
   - 2020 week 4: jizzmonkey69 only made a Deep pick. The Standard slot is
     imported as a 0-point "No pick".
4. **Quarterbacks** lists the picks that weren't an exact name match:
   - Mitch Trubisky is matched by last name and points.
   - Drew Lock (2020 week 12), Trey Lance (2021 week 7) and Justin Fields (2021
     week 16) sat out, so their game is found from their team.
5. Click **Import**. The first import of a year also pulls that season's NFL
   games from Sleeper.
6. Compare **Season totals** with the sheet's leaderboard tab. Every member
   should match to the cent, except apatel78 in 2020, who drops whichever of the
   two duplicate pairs you left out.
