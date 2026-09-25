import type { SleeperStatsJson } from '~/libs/sleeper/schemas';

/**
 * A single player's stat line from Sleeper. Sleeper only emits the categories a
 * player actually recorded, so every read below defaults to 0.
 */
export type QbStreamingStats = SleeperStatsJson[string];

/**
 * QB streaming scoring: 4pt passing TDs, 1pt per 25 passing yards, minus two
 * for turnovers.
 *
 * The admin week scorer (`admin.qb-streaming._index.tsx`) and the historical
 * import both read from here, so an imported season is checked against the
 * same rules the site scores live weeks on.
 */
export function scoreQbStats(stats: QbStreamingStats): number {
  return (
    Math.round(
      100 *
        (0.04 * (stats.pass_yd || 0) +
          4 * (stats.pass_td || 0) +
          0.1 * (stats.rush_yd || 0) +
          6 * (stats.rush_td || 0) +
          0.1 * (stats.rec_yd || 0) +
          6 * (stats.rec_td || 0) +
          -2 * (stats.fum_lost || 0) +
          -2 * (stats.pass_int || 0) +
          2 * (stats.pass_2pt || 0) +
          2 * (stats.rush_2pt || 0) +
          2 * (stats.rec_2pt || 0)),
    ) / 100
  );
}
