/**
 * Working out a league's median games from the scores themselves.
 *
 * A median game is a second matchup each week against the league's median
 * score. Sleeper reports the result of that game in a per-team `metadata.record`
 * string, which the league sync parses - but Sleeper drops that string for old
 * seasons, so in practice it only covers 2024 onward. Everything before that
 * arrives as zeroes, which is why the site showed a dash for every median
 * season but the most recent one.
 *
 * None of that matters, because the scores are already stored. The median of a
 * week's scores is recoverable from the `TeamGame` rows for that week, and a
 * team's median result is just its score against that number. Checked against
 * the seasons Sleeper does still describe, this reproduces Sleeper's own
 * figures exactly.
 */

export type MedianGameRow = {
  teamId: string;
  week: number;
  pointsScored: number;
};

export type DerivedMedianRecord = {
  medianWins: number;
  medianLosses: number;
  medianTies: number;
};

/**
 * The midpoint of a set of scores, averaging the middle pair when there is an
 * even number of them.
 *
 * This is Postgres's `percentile_cont(0.5)`, and it matters that it is: with
 * twelve teams there is no single middle score, and taking either neighbour
 * instead would hand one of them a win it did not earn.
 */
export function medianOf(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * Median records for every team in one league, from that league's regular
 * season rows.
 *
 * Weeks that cannot have been played are skipped rather than scored. A week
 * with one row is a league still being backfilled, and a week where everyone
 * scored zero has not happened yet - scoring either would hand out a full slate
 * of losses against a median of nothing.
 */
export function deriveMedianRecords(
  rows: MedianGameRow[],
): Map<string, DerivedMedianRecord> {
  const byWeek = new Map<number, MedianGameRow[]>();
  for (const row of rows) {
    const week = byWeek.get(row.week);
    if (week) week.push(row);
    else byWeek.set(row.week, [row]);
  }

  const records = new Map<string, DerivedMedianRecord>();
  const recordFor = (teamId: string) => {
    const existing = records.get(teamId);
    if (existing) return existing;

    const created = { medianWins: 0, medianLosses: 0, medianTies: 0 };
    records.set(teamId, created);
    return created;
  };

  for (const week of byWeek.values()) {
    if (week.length < 2) continue;
    if (week.every(row => row.pointsScored === 0)) continue;

    const median = medianOf(week.map(row => row.pointsScored));

    for (const row of week) {
      const record = recordFor(row.teamId);
      if (row.pointsScored > median) record.medianWins++;
      else if (row.pointsScored < median) record.medianLosses++;
      else record.medianTies++;
    }
  }

  return records;
}
