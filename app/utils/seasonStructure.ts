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
  const boundary = playoffWeekStart ?? historicalPlayoffWeekStart(year);
  return week < boundary;
}

/**
 * Whether a league played median games, inferred from its own team records.
 *
 * There is exactly one median game per week, so a league that played them has
 * teams whose median game count matches their head-to-head game count. A league
 * that did not has all zeroes. This is why the median era needs no API call: it
 * is already recorded in every `Team` row, retroactively, for every season.
 *
 * Teams are checked in aggregate rather than individually because a team added
 * late can carry a short record without meaning the league changed rules.
 */
export function leaguePlayedMedianGames(
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
