/**
 * Competition ranking ("1224"): equal scores share a rank, and the next
 * distinct score skips the ranks they consumed.
 *
 * The leaderboards used to disagree about this - D12 ranked this way while the
 * league boards just numbered the sorted rows, so two tied managers were shown
 * as 4th and 5th with nothing to distinguish them.
 *
 * @param items - already sorted best-first
 * @param valueOf - the score each rank is based on
 */
export function assignCompetitionRanks<T>(
  items: T[],
  valueOf: (item: T) => number,
): (T & { rank: number })[] {
  let rank = 0;
  let previousValue: number | undefined;

  return items.map((item, index) => {
    const value = valueOf(item);
    if (previousValue === undefined || value !== previousValue) {
      rank = index + 1;
      previousValue = value;
    }
    return { ...item, rank };
  });
}
