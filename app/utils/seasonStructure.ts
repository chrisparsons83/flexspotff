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

/**
 * Where the current season stands, as every profile tab and sync should read
 * it.
 *
 * `inProgressYear` is the season still being played, or null once it has
 * ended - `Season.isCurrent` alone stays on a season from the summer it opens
 * until an admin flips the next one in, which used to leave a January-finished
 * season marked "Current" right through the offseason.
 *
 * `settledWeek` is the last week of `inProgressYear` whose games are all final.
 * A week being played is not a result yet: a Thursday-night partial score is
 * not a loss, and it is not anybody's worst week.
 */
export type SeasonState = {
  inProgressYear: number | null;
  settledWeek: number;
};

/** No season running: everything on record is final. */
export const NO_SEASON_IN_PROGRESS: SeasonState = {
  inProgressYear: null,
  settledWeek: 0,
};

/** NFL regular season length: 17 weeks through 2020, 18 from 2021. */
export function nflRegularSeasonWeeks(year: number): number {
  return year >= 2021 ? 18 : 17;
}

/**
 * How long after a week's last kickoff it counts as final. Monday night is over
 * in under four hours, and the score sync has followed it the whole way. Kept
 * short of the Tuesday-morning league sync, so the week before the playoffs
 * has settled by the time that sync goes looking for a bracket.
 */
export const WEEK_SETTLES_AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * How long after the last game of the year a season counts as over. The side
 * games are scored by an admin after the final week, and a title should not
 * be handed out from a half-scored last week.
 */
export const SEASON_ENDS_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The season state for one year, from the last kickoff of each week of its NFL
 * schedule.
 *
 * Kickoff times rather than game statuses: the score sync only refreshes the
 * week being played, so a status that was never updated would hold a week open
 * forever, whereas a kickoff time is written once when the schedule is pulled.
 *
 * A schedule that stops short of the final NFL week has not been fully synced,
 * and is never taken to mean the season is over.
 */
export function seasonStateFromSchedule({
  year,
  lastKickoffByWeek,
  now,
}: {
  year: number;
  lastKickoffByWeek: { week: number; lastKickoff: Date }[];
  now: Date;
}): SeasonState {
  const settled = (kickoff: Date, after: number) =>
    kickoff.getTime() + after <= now.getTime();

  const weeks = [...lastKickoffByWeek].sort((a, b) => a.week - b.week);

  // Weeks settle in order: a week only counts once every week before it has.
  let settledWeek = 0;
  for (const { week, lastKickoff } of weeks) {
    if (week !== settledWeek + 1) break;
    if (!settled(lastKickoff, WEEK_SETTLES_AFTER_MS)) break;
    settledWeek = week;
  }

  const finalWeek = weeks.find(
    week => week.week === nflRegularSeasonWeeks(year),
  );
  const ended =
    finalWeek !== undefined &&
    settledWeek >= finalWeek.week &&
    settled(finalWeek.lastKickoff, SEASON_ENDS_AFTER_MS);

  return ended ? NO_SEASON_IN_PROGRESS : { inProgressYear: year, settledWeek };
}

/** Whether a week's results are final: any past season, or a settled week. */
export function isSettledWeek(
  { year, week }: { year: number; week: number },
  state: SeasonState,
): boolean {
  return year !== state.inProgressYear || week <= state.settledWeek;
}

/**
 * Whether a league's regular season has been played out, so its standings are
 * final and its postseason brackets mean something.
 *
 * Until then nothing about the playoffs or the sacko is real, whatever Sleeper
 * has or has not put in a bracket.
 */
export function regularSeasonIsOver(
  league: { year: number; playoffWeekStart: number | null | undefined },
  state: SeasonState,
): boolean {
  return (
    league.year !== state.inProgressYear ||
    state.settledWeek >= regularSeasonWeeks(league)
  );
}
