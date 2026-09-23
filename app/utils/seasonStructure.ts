/**
 * Where the regular season ends, and whether a league played median games.
 *
 * Both of these used to be hardcoded, which meant every schedule change needed a
 * code change. They are now read from the league's own Sleeper settings, with
 * the historical rule kept only as a fallback for leagues that have not been
 * synced yet.
 */

/**
 * The boundary that applied before `playoffWeekStart` was synced: weeks 1-13
 * were the regular season through 2020, and weeks 1-14 from 2021 on.
 *
 * This mirrors the backfill in
 * `prisma/migrations/20240917050428_keep_track_of_regular_season_games`, which
 * is the authority on how existing `TeamGame.isRegularSeason` values were set.
 * Changing one without the other would silently reclassify old games.
 */
export function historicalPlayoffWeekStart(year: number): number {
  return year >= 2021 ? 15 : 14;
}

/**
 * Whether a given week is a regular season game for a league.
 *
 * `playoffWeekStart` is null for any league whose settings have not been synced
 * yet, so a partial backfill falls back to the historical boundary rather than
 * classifying every week as a playoff game.
 */
export function isRegularSeasonWeek({
  week,
  year,
  playoffWeekStart,
}: {
  week: number;
  year: number;
  playoffWeekStart: number | null | undefined;
}): boolean {
  // A boundary of zero or less cannot be real, and `??` would happily accept it
  // and mark the entire season as playoffs. Anything non-positive is treated as
  // "not synced" so the historical rule applies instead.
  const boundary = isUsablePlayoffWeekStart(playoffWeekStart)
    ? playoffWeekStart
    : historicalPlayoffWeekStart(year);
  return week < boundary;
}

/**
 * Whether a value from Sleeper is a believable playoff start week.
 *
 * Sleeper can report `0` for a league whose playoffs were never configured, and
 * storing that would silently reclassify every game of the season.
 */
export function isUsablePlayoffWeekStart(
  value: number | null | undefined,
): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** How many weeks of a league's season are head-to-head games. */
export function regularSeasonWeeks({
  year,
  playoffWeekStart,
}: {
  year: number;
  playoffWeekStart: number | null | undefined;
}): number {
  const boundary = isUsablePlayoffWeekStart(playoffWeekStart)
    ? playoffWeekStart
    : historicalPlayoffWeekStart(year);
  return boundary - 1;
}

/**
 * Whether Sleeper is still reporting median results for this league.
 *
 * `Team.median*` is parsed out of Sleeper's `metadata.record` string, which
 * Sleeper only keeps for recent seasons - in production it is populated from
 * 2024 on and all zeroes before that, even for seasons that certainly played
 * medians. So this answers "does Sleeper still know", not "did it happen", and
 * it is the only signal available part-way through a season.
 *
 * Teams are checked in aggregate rather than individually because a team added
 * late can carry a short record without meaning the league changed rules.
 */
export function teamsHaveMedianResults(
  teams: {
    medianWins: number;
    medianLosses: number;
    medianTies: number;
  }[],
): boolean {
  return teams.some(
    team => team.medianWins + team.medianLosses + team.medianTies > 0,
  );
}

/**
 * Whether a league played median games, counted off the season itself.
 *
 * A median game is a second game every week, and Sleeper folds it into the
 * record it reports, so a median league's teams finish with twice as many games
 * as the season had weeks. That holds for every season we have, including the
 * ones Sleeper has since forgotten the median string for: 2018 and 2019 played
 * 13 games in 13 weeks, 2020 played 26 in 13, and 2021 onward 28 in 14.
 *
 * The maximum across teams is what counts, not any one team: a replacement
 * joining mid-season carries a short record, which would make both `some` and
 * `every` read a median league as a normal one.
 */
export function leaguePlayedMedianGames({
  teams,
  regularSeasonWeeks,
}: {
  teams: { wins: number; losses: number; ties: number }[];
  regularSeasonWeeks: number;
}): boolean {
  if (regularSeasonWeeks <= 0) return false;

  const mostGames = teams.reduce(
    (most, team) => Math.max(most, team.wins + team.losses + team.ties),
    0,
  );

  return mostGames > 0 && mostGames === 2 * regularSeasonWeeks;
}
