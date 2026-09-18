import type { SleeperStatsJson } from '~/libs/sleeper/schemas';

/**
 * A single player's stat line from Sleeper. Every field is optional - Sleeper
 * only emits the categories a player actually recorded - so every read below
 * defaults to 0.
 */
export type DfsSurvivorStats = SleeperStatsJson[string];

/** Two decimal places, the precision entry points have always been stored at. */
const round = (points: number) => Math.round(100 * points) / 100;

/**
 * DFS Survivor scoring: half PPR, 4pt passing TDs, distance-tiered kicking, and
 * a defense that is scored on tiers of points and yards allowed.
 *
 * This is the single source of truth for the format. Both the admin week scorer
 * (`admin.dfs-survivor._index.tsx`) and the player score sync read from here, so
 * the numbers shown in the picker match the numbers entries are scored on.
 */
export function scoreDfsSurvivorPlayer(
  position: string | null | undefined,
  stats: DfsSurvivorStats,
): number {
  switch (position) {
    case 'QB':
      return round(
        0.04 * (stats.pass_yd || 0) +
          4 * (stats.pass_td || 0) +
          0.1 * (stats.rush_yd || 0) +
          6 * (stats.rush_td || 0) +
          0.1 * (stats.rec_yd || 0) +
          6 * (stats.rec_td || 0) +
          -2 * (stats.fum_lost || 0) +
          -2 * (stats.pass_int || 0) +
          2 * (stats.pass_2pt || 0) +
          2 * (stats.rush_2pt || 0) +
          2 * (stats.rec_2pt || 0),
      );

    case 'RB':
      return round(
        0.1 * (stats.rush_yd || 0) +
          6 * (stats.rush_td || 0) +
          0.5 * (stats.rec || 0) +
          0.1 * (stats.rec_yd || 0) +
          6 * (stats.rec_td || 0) +
          -2 * (stats.fum_lost || 0) +
          2 * (stats.rush_2pt || 0) +
          2 * (stats.rec_2pt || 0),
      );

    // WR and TE share a line: half PPR receiving plus any rushing work.
    case 'WR':
    case 'TE':
      return round(
        0.5 * (stats.rec || 0) +
          0.1 * (stats.rec_yd || 0) +
          6 * (stats.rec_td || 0) +
          0.1 * (stats.rush_yd || 0) +
          6 * (stats.rush_td || 0) +
          -2 * (stats.fum_lost || 0) +
          2 * (stats.rec_2pt || 0) +
          2 * (stats.rush_2pt || 0),
      );

    case 'K':
      return round(
        3 * (stats.fgm_0_19 || 0) +
          3 * (stats.fgm_20_29 || 0) +
          3 * (stats.fgm_30_39 || 0) +
          4 * (stats.fgm_40_49 || 0) +
          5 * (stats.fgm_50p || 0) +
          1 * (stats.xpm || 0) -
          1 * (stats.fgmiss || 0) -
          1 * (stats.xpmiss || 0),
      );

    case 'DEF':
      return round(scoreDefense(stats));

    default:
      return 0;
  }
}

function scoreDefense(stats: DfsSurvivorStats): number {
  let points = 0;

  // Points allowed. Only applied when Sleeper reported the category at all -
  // an absent `pts_allow` means the game has not been played, not a shutout.
  if (stats.pts_allow !== undefined) {
    if (stats.pts_allow <= 20) points += 0;
    else if (stats.pts_allow <= 27) points -= 1;
    else if (stats.pts_allow <= 34) points -= 2;
    else points -= 3;
  }

  if (stats.yds_allow !== undefined) {
    if (stats.yds_allow < 350) points += 0;
    else if (stats.yds_allow <= 449) points -= 1;
    else if (stats.yds_allow <= 549) points -= 2;
    else points -= 3;
  }

  points +=
    6 * (stats.def_st_td || 0) +
    2 * (stats.int || 0) +
    2 * (stats.fum_rec || 0) +
    4 * (stats.safe || 0) +
    1 * (stats.sack || 0) +
    3 * (stats.blk_kick || 0) +
    0.5 * (stats.tkl_loss || 0);

  return points;
}
