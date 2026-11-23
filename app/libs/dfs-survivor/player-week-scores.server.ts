import { scoreDfsSurvivorPlayer } from './scoring';
import { prisma } from '~/db.server';
import { getProjections, getWeeklyStats } from '~/libs/sleeper/api.server';
import type {
  SleeperProjectionsJson,
  SleeperStatsJson,
} from '~/libs/sleeper/schemas';

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
 *
 * Each batch is its own short `$transaction`, so it runs on one connection. The
 * batches used to be fired with `Promise.all`, 100 upserts at once against a
 * pool of 3 connections. Overlapping a live-game score sync, that queue blew
 * the pool timeout (P2024), and the failure aborted the whole scheduler.
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
  return writePlayerWeekScores(year, week, { stats, projections });
}

/**
 * The stats half of `syncPlayerWeekScores`: one Sleeper call, rescored into
 * each player's points, projections left alone. The live score monitor runs
 * this every few minutes while games are on.
 */
export async function syncPlayerWeekPoints(year: number, week: number) {
  const stats = await getWeeklyStats(year, week);
  return writePlayerWeekScores(year, week, { stats });
}

/**
 * The projections half of `syncPlayerWeekScores`, for a week the live score
 * monitor is already keeping the points of.
 */
export async function syncPlayerWeekProjections(year: number, week: number) {
  const projections = await getProjections(year, week);
  return writePlayerWeekScores(year, week, { projections });
}

/** Writes whichever of points and projections it is given, and only those. */
async function writePlayerWeekScores(
  year: number,
  week: number,
  {
    stats,
    projections,
  }: { stats?: SleeperStatsJson; projections?: SleeperProjectionsJson },
) {
  const sleeperIds = new Set([
    ...Object.keys(stats ?? {}),
    ...Object.keys(projections ?? {}),
  ]);

  const players = await prisma.player.findMany({
    where: { sleeperId: { in: [...sleeperIds] } },
    select: { id: true, sleeperId: true, position: true },
  });

  const upserts = players.flatMap(player => {
    const statLine = stats?.[player.sleeperId];
    const data: { points?: number | null; projection?: number | null } = {};
    if (stats) {
      data.points = statLine
        ? scoreDfsSurvivorPlayer(player.position, statLine)
        : null;
    }
    if (projections) {
      data.projection = projections[player.sleeperId]?.pts_half_ppr ?? null;
    }

    // Nothing worth storing for a player Sleeper listed but has no numbers for.
    if (Object.values(data).every(value => value == null)) return [];

    return prisma.playerWeekScore.upsert({
      where: {
        playerId_year_week: { playerId: player.id, year, week },
      },
      update: data,
      create: { playerId: player.id, year, week, ...data },
    });
  });

  for (let i = 0; i < upserts.length; i += UPSERT_BATCH_SIZE) {
    await prisma.$transaction(upserts.slice(i, i + UPSERT_BATCH_SIZE));
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
 * One week's stored Sleeper projections, as a playerId map. This runs on every
 * entry page load.
 */
export async function getWeekProjectionsByPlayer(year: number, week: number) {
  const scores = await prisma.playerWeekScore.findMany({
    where: { year, week, projection: { not: null } },
    select: { playerId: true, projection: true },
  });

  return new Map(scores.map(score => [score.playerId, score.projection!]));
}
