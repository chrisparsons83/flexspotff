import { scoreDfsSurvivorPlayer } from './scoring';
import { prisma } from '~/db.server';
import { getProjections, getWeeklyStats } from '~/libs/sleeper/api.server';

/**
 * Keeps `PlayerWeekScore` in step with Sleeper.
 *
 * The admin week scorer only ever writes points for players somebody picked, so
 * it cannot answer "who has scored the most this year" for the entry picker.
 * This module fills that gap by storing a row for every player every week.
 */

/**
 * Rows are independent derived data, so they are written in batches rather than
 * one transaction. A single `$transaction` held ~2,000 statements open per week
 * and ran inline in the admin score-week request, which invites statement and
 * transaction timeouts; a partial batch just gets corrected on the next run.
 */
const UPSERT_BATCH_SIZE = 100;

/**
 * Pulls one week's actual stats and projections from Sleeper and upserts a row
 * per player. Players Sleeper has no data for are skipped rather than zeroed -
 * a missing stat line means "not played", which is not the same as a 0.
 */
export async function syncPlayerWeekScores(year: number, week: number) {
  const [stats, projections] = await Promise.all([
    getWeeklyStats(year, week),
    getProjections(year, week),
  ]);

  const sleeperIds = new Set([
    ...Object.keys(stats),
    ...Object.keys(projections),
  ]);

  const players = await prisma.player.findMany({
    where: { sleeperId: { in: [...sleeperIds] } },
    select: { id: true, sleeperId: true, position: true },
  });

  const upserts = players.flatMap(player => {
    const statLine = stats[player.sleeperId];
    const projection = projections[player.sleeperId]?.pts_half_ppr ?? null;

    const points = statLine
      ? scoreDfsSurvivorPlayer(player.position, statLine)
      : null;

    // Nothing worth storing for a player Sleeper listed but has no numbers for.
    if (points === null && projection === null) return [];

    const data = { points, projection };

    return prisma.playerWeekScore.upsert({
      where: {
        playerId_year_week: { playerId: player.id, year, week },
      },
      update: data,
      create: { playerId: player.id, year, week, ...data },
    });
  });

  for (let i = 0; i < upserts.length; i += UPSERT_BATCH_SIZE) {
    await Promise.all(upserts.slice(i, i + UPSERT_BATCH_SIZE));
  }

  return { year, week, playersWritten: upserts.length };
}

/**
 * Season-to-date DFS Survivor points for every player, as a playerId -> points
 * map. Summed in SQL rather than in JS - this runs on every entry page load.
 */
export async function getSeasonTotalsByPlayer(year: number) {
  const totals = await prisma.playerWeekScore.groupBy({
    where: { year },
    by: ['playerId'],
    _sum: { points: true },
  });

  return new Map(totals.map(row => [row.playerId, row._sum.points ?? 0]));
}

/**
 * One week's stored numbers, as two playerId maps: `projections` holds Sleeper's
 * projection and `actuals` the scored stat line. A player is absent from
 * `actuals` until Sleeper has a stat line for them, so a missing key means "no
 * stat line stored yet" rather than a zero.
 *
 * Both maps come off a single query - this runs on every entry page load.
 */
export async function getWeekScoresByPlayer(year: number, week: number) {
  const scores = await prisma.playerWeekScore.findMany({
    where: { year, week },
    select: { playerId: true, projection: true, points: true },
  });

  const projections = new Map<string, number>();
  const actuals = new Map<string, number>();

  for (const score of scores) {
    if (score.projection !== null)
      projections.set(score.playerId, score.projection);
    if (score.points !== null) actuals.set(score.playerId, score.points);
  }

  return { projections, actuals };
}
