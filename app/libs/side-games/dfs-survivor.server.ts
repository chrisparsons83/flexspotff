import type { SideGameScorer } from './types';
import { syncPlayerWeekScores } from '~/libs/dfs-survivor/player-week-scores.server';
import { scoreDfsSurvivorPlayer } from '~/libs/dfs-survivor/scoring';
import { getWeeklyStats } from '~/libs/sleeper/api.server';
import { syncNflGameWeek } from '~/libs/syncs.server';
import { updateDfsSurvivorEntryPoints } from '~/models/dfssurvivoruserentry.server';
import {
  getDfsSurvivorWeekByYearAndWeek,
  getDfsSurvivorWeeksWithEntries,
  updateDfsSurvivorWeekScored,
} from '~/models/dfssurvivorweek.server';
import { areAllNflGamesComplete } from '~/utils/helpers';

export type ScoreDfsSurvivorWeekResult = {
  scored: boolean;
  message: string;
  /** A non-fatal follow-up failure; the week is still scored. */
  warning?: string;
};

/**
 * Scores one DFS Survivor week, shared by the admin Score Week button and the
 * weekly automation so the two cannot drift apart.
 *
 * The stored games are synced first, because a game that has since moved or
 * finished cannot be judged from a stale row. Scoring then refuses until every
 * game of the week is complete, so the admin button cannot freeze an in-progress
 * game's players at zero. Every user's week row is loaded with its entries, each
 * entry is scored from its player's Sleeper stat line, and all the rows are
 * marked scored. The player-week scores are then refreshed for the entry
 * picker's season-to-date column; that refresh is derived data, so its failure
 * is a warning rather than a failed score - the week stays scored and can be
 * refreshed on its own.
 */
export async function scoreDfsSurvivorWeek(
  year: number,
  weekNumber: number,
): Promise<ScoreDfsSurvivorWeekResult> {
  const weekRecords = await getDfsSurvivorWeeksWithEntries(year, weekNumber);
  if (weekRecords.length === 0) {
    return {
      scored: false,
      message: 'No DFS survivor week records found for this week',
    };
  }

  await syncNflGameWeek(year, [weekNumber]);
  if (!(await areAllNflGamesComplete(year, weekNumber))) {
    return {
      scored: false,
      message: 'Not all games have been completed, scoring cannot proceed',
    };
  }

  const sleeperJson = await getWeeklyStats(year, weekNumber);

  await Promise.all(
    weekRecords.flatMap(weekRecord =>
      weekRecord.entries.map(entry => {
        const stats = sleeperJson[entry.player.sleeperId] || {};
        const points = scoreDfsSurvivorPlayer(entry.player.position, stats);
        return updateDfsSurvivorEntryPoints(entry.id, points);
      }),
    ),
  );

  await updateDfsSurvivorWeekScored(year, weekNumber, true);

  try {
    await syncPlayerWeekScores(year, weekNumber);
  } catch (error) {
    console.error('Player score sync after scoring failed:', error);
    return {
      scored: true,
      message:
        'Week has been scored, but refreshing player scores failed. Use Sync player scores to retry.',
      warning: `Player score refresh failed: ${errorMessage(error)}`,
    };
  }

  return { scored: true, message: 'Week has been scored.' };
}

/**
 * The admin escape hatch behind a scored DFS Survivor week: reset every entry's
 * points and mark the week's rows unscored. Scoring recomputes from current
 * stats, so a reverted week may be scored again - by hand or by the automation.
 */
export async function revertDfsSurvivorWeek(year: number, weekNumber: number) {
  const weekRecords = await getDfsSurvivorWeeksWithEntries(year, weekNumber);
  if (weekRecords.length === 0) {
    return {
      reverted: false,
      message: 'No DFS survivor week records found for this week',
    };
  }

  await Promise.all(
    weekRecords.flatMap(weekRecord =>
      weekRecord.entries.map(entry =>
        updateDfsSurvivorEntryPoints(entry.id, 0),
      ),
    ),
  );

  await updateDfsSurvivorWeekScored(year, weekNumber, false);

  return { reverted: true, message: 'Week scoring has been reverted.' };
}

/**
 * The DFS Survivor half of the scoring phase. A week with no rows, or whose
 * first row says it is already scored, is skipped; the admin route uses the same
 * "first row is scored" rule. DFS Survivor has no `autoManaged` column: a
 * scored week is its ownership signal, and a reverted one may be scored again.
 *
 * The completeness guard lives in the shared score function, so the admin
 * button refuses an incomplete week too.
 */
export const dfsSurvivorScorer: SideGameScorer = {
  game: 'DFS Survivor',
  async scoreWeek(year: number, week: number) {
    const dfsWeek = await getDfsSurvivorWeekByYearAndWeek(year, week);
    if (!dfsWeek || dfsWeek.isScored) return { status: 'skipped' };

    const { scored, warning } = await scoreDfsSurvivorWeek(year, week);
    if (!scored) return { status: 'skipped' };

    return warning ? { status: 'scored', warning } : { status: 'scored' };
  },
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
