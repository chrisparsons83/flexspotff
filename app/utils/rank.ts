/**
 * Competition ranking ("1224"): equal scores share a rank, and the next
 * distinct score skips the ranks they consumed.
 *
 * The leaderboards used to disagree about this - D12 ranked this way while the
 * league boards just numbered the sorted rows, so two tied managers were shown
 * as 4th and 5th with nothing to distinguish them.
 *
 * @param items - already sorted best-first
 * @param valueOf - the score each rank is based on, or several when ties on
 *   the first are broken by the next - two items share a rank only when every
 *   one of them is equal
 */
export function assignCompetitionRanks<T>(
  items: T[],
  valueOf: (item: T) => number | readonly number[],
): (T & { rank: number })[] {
  let rank = 0;
  let previousValue: readonly number[] | undefined;

  return items.map((item, index) => {
    const raw = valueOf(item);
    const value = typeof raw === 'number' ? [raw] : raw;
    if (previousValue === undefined || !sameValues(value, previousValue)) {
      rank = index + 1;
      previousValue = value;
    }
    return { ...item, rank };
  });
}

function sameValues(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
