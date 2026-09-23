/**
 * How each side game decides a season.
 *
 * These rules are shared by two callers that must never disagree: each game's
 * standings page, and the title badges on a member's profile. A badge that
 * contradicted the standings page that awarded it would be worse than no badge,
 * so the rules live here rather than being written out twice.
 *
 * Two of them are not what you would guess:
 *
 * - QB Streaming counts only a member's best twelve weeks - but only from 2025.
 *   Earlier seasons are a straight sum.
 * - A Locks week is worth nothing at all if the member took a single loss in it.
 */

/** QB Streaming counts a member's best weeks only. */
export const QB_STREAMING_COUNTING_WEEKS = 12;

/**
 * The first season scored on best-twelve-weeks. Before this every week counted,
 * and old standings must keep reading the way they always have.
 */
export const QB_STREAMING_TOP_WEEKS_FROM_YEAR = 2025;

export function qbStreamingUsesTopWeeks(year: number): boolean {
  return year >= QB_STREAMING_TOP_WEEKS_FROM_YEAR;
}

/**
 * The weeks that actually count towards a total: the highest-scoring `limit` of
 * them.
 *
 * Returns the weeks themselves rather than just a total, because the standings
 * page marks which of a member's weeks counted and which were dropped.
 */
export function selectCountingWeeks<T>(
  weeks: T[],
  scoreOf: (week: T) => number,
  limit: number,
): T[] {
  return [...weeks].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, limit);
}

/** Sum of the highest `limit` weekly scores. */
export function topWeeksTotal(
  weeklyScores: number[],
  limit: number = QB_STREAMING_COUNTING_WEEKS,
): number {
  return selectCountingWeeks(weeklyScores, score => score, limit).reduce(
    (total, score) => total + score,
    0,
  );
}

/**
 * A member's QB Streaming season total, under whichever rule applied that year.
 */
export function qbStreamingSeasonTotal(
  weeklyScores: number[],
  year: number,
): number {
  return qbStreamingUsesTopWeeks(year)
    ? topWeeksTotal(weeklyScores)
    : weeklyScores.reduce((total, score) => total + score, 0);
}

/**
 * What a Locks week is worth: the member's wins, unless they lost anything that
 * week, in which case the week is a write-off.
 */
export function locksWeekPoints(week: {
  isWin: number | null;
  isLoss: number | null;
}): number {
  if ((week.isLoss ?? 0) !== 0) return 0;
  return week.isWin ?? 0;
}

/** An F² entry is worth the combined points-for of the teams it picked. */
export function fSquaredEntryPoints(teams: { pointsFor: number }[]): number {
  return teams.reduce((total, team) => total + team.pointsFor, 0);
}

/**
 * The members with the highest total, as a set - a tie crowns everyone who
 * tied.
 *
 * A season with no entrants has no winner, and neither does one where nobody
 * scored above zero: the spread pool can go negative, and a losing season is
 * still not a win.
 */
export function winnersOf(totals: Map<string, number>): Set<string> {
  if (totals.size === 0) return new Set();

  const best = Math.max(...totals.values());
  if (best <= 0) return new Set();

  return new Set(
    [...totals.entries()]
      .filter(([, total]) => total === best)
      .map(([userId]) => userId),
  );
}

/** Adds `amount` to `key`'s running total. */
export function addTo(
  totals: Map<string, number>,
  key: string,
  amount: number,
): void {
  totals.set(key, (totals.get(key) ?? 0) + amount);
}
