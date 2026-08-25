/**
 * How each side game decides a season.
 *
 * Two of these are not what you would guess, which is why they live here as
 * named, tested functions rather than inline in a query: QB Streaming counts
 * only a member's best twelve weeks, and a Locks week is worth nothing at all
 * if you took a single loss in it.
 *
 * These mirror the rules in each game's standings route. If a rule changes
 * there, it has to change here too, or a badge will contradict the standings
 * page that awarded it.
 */

/** QB Streaming counts a member's best weeks only, not the whole season. */
export const QB_STREAMING_COUNTING_WEEKS = 12;

/**
 * Sum of the highest `limit` weekly scores.
 *
 * Mirrors `games.qb-streaming.standings.$year._index.tsx`, which sorts a
 * member's weeks descending and keeps the top twelve.
 */
export function topWeeksTotal(
  weeklyScores: number[],
  limit: number = QB_STREAMING_COUNTING_WEEKS,
): number {
  return [...weeklyScores]
    .sort((a, b) => b - a)
    .slice(0, limit)
    .reduce((total, score) => total + score, 0);
}

/**
 * What a Locks week is worth: your wins, unless you lost anything that week,
 * in which case the week is a write-off.
 *
 * Mirrors `games.locks-challenge.standings.$year._index.tsx`.
 */
export function locksWeekPoints(week: {
  isWin: number | null;
  isLoss: number | null;
}): number {
  if ((week.isLoss ?? 0) !== 0) return 0;
  return week.isWin ?? 0;
}

/**
 * The members with the highest total, as a set - a tie means nobody is
 * demoted, so a shared season crowns both.
 *
 * A season with no entrants has no winner, and a season where everyone scored
 * zero is treated the same way rather than crowning the whole league.
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
