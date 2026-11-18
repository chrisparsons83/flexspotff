import type { SideGameScorer } from './types';
import type { QBStreamingWeek } from '@prisma/client';
import { scoreQbStats } from '~/libs/qb-streaming/scoring';
import { getWeeklyStats } from '~/libs/sleeper/api.server';
import { syncNflGameWeek } from '~/libs/syncs.server';
import {
  getQBStreamingWeekByYearAndWeek,
  updateQBStreamingWeek,
} from '~/models/qbstreamingweek.server';
import {
  getQBStreamingWeekOptionsForSync,
  updateQBStreamingWeekOptionScore,
} from '~/models/qbstreamingweekoption.server';
import { areAllNflGamesComplete } from '~/utils/helpers';

export type ScoreQbStreamingWeekResult = {
  scored: boolean;
  message: string;
};

/**
 * Scores one QB Streaming week, shared by the admin Score Week button and the
 * weekly automation so the two cannot drift apart.
 *
 * The stored slate is synced first, because a game that has since moved or
 * finished cannot be judged from a stale row. Scoring then refuses until every
 * game of the week is complete; each option is scored from its quarterback's
 * Sleeper stat line and the week is marked scored.
 */
export async function scoreQbStreamingWeek(
  year: number,
  weekNumber: number,
  {
    /**
     * Admin-only safety: drop games Sleeper no longer lists for the week so
     * their options are never scored. The automation leaves a short answer from
     * Sleeper alone, where a dropped game would quietly void real picks.
     */
    removeStaleGames = false,
  }: { removeStaleGames?: boolean } = {},
): Promise<ScoreQbStreamingWeekResult> {
  const qbStreamingWeek: QBStreamingWeek | null =
    await getQBStreamingWeekByYearAndWeek(year, weekNumber);
  if (!qbStreamingWeek) {
    return { scored: false, message: `There's no QB streaming week here` };
  }

  await syncNflGameWeek(year, [weekNumber], { removeStaleGames });

  const allGamesCompleted = await areAllNflGamesComplete(year, weekNumber);
  if (!allGamesCompleted) {
    return {
      scored: false,
      message: 'Not all games have been completed, scoring cannot proceed',
    };
  }

  const [sleeperJson, options] = await Promise.all([
    getWeeklyStats(year, weekNumber, ['QB']),
    getQBStreamingWeekOptionsForSync(qbStreamingWeek.id),
  ]);

  await Promise.all(
    options.map(qbStreamingOption => {
      const stats = sleeperJson[qbStreamingOption.player.sleeperId] || {};
      return updateQBStreamingWeekOptionScore(
        qbStreamingOption.id,
        scoreQbStats(stats),
      );
    }),
  );

  await updateQBStreamingWeek({
    id: qbStreamingWeek.id,
    year: qbStreamingWeek.year,
    week: qbStreamingWeek.week,
    isOpen: qbStreamingWeek.isOpen,
    isScored: true,
  });

  return { scored: true, message: 'Week has been scored.' };
}

/**
 * The QB Streaming half of the scoring phase. A missing week, a week already
 * scored, or a week that never opened (so nothing could have been entered) is
 * skipped. QB Streaming has no `autoManaged` column: those flags are its
 * ownership signal.
 */
export const qbStreamingScorer: SideGameScorer = {
  game: 'QB Streaming',
  async scoreWeek(year: number, week: number) {
    const qbStreamingWeek: QBStreamingWeek | null =
      await getQBStreamingWeekByYearAndWeek(year, week);
    if (
      !qbStreamingWeek ||
      qbStreamingWeek.isScored ||
      !qbStreamingWeek.isOpen
    ) {
      return { status: 'skipped' };
    }

    const { scored } = await scoreQbStreamingWeek(year, week);
    return scored ? { status: 'scored' } : { status: 'skipped' };
  },
};
