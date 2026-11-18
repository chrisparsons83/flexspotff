import type { SideGameScorer } from './types';
import type { LocksWeek } from '@prisma/client';
import { syncNflGameWeek } from '~/libs/syncs.server';
import { getLocksGamesByYearAndWeek } from '~/models/locksgame.server';
import {
  deleteLocksGamePicksNotActive,
  updateLocksGamePicksWithResults,
} from '~/models/locksgamepicks.server';
import {
  getLocksWeekByYearAndWeek,
  updateLocksWeek,
} from '~/models/locksweek.server';
import { areAllNflGamesComplete } from '~/utils/helpers';

export type ScoreLocksWeekResult = {
  scored: boolean;
  message: string;
};

/**
 * Scores one Locks Challenge week, shared by the admin Score Week button and
 * the weekly automation so the two cannot drift apart.
 *
 * The stored slate is synced first, because a game that has since moved or
 * finished cannot be judged from a stale row. Scoring then refuses until every
 * game of the week is complete; picks are marked won or lost and any pick on a
 * team no longer in the game is deleted.
 */
export async function scoreLocksWeek(
  year: number,
  weekNumber: number,
  {
    /**
     * Admin-only safety: drop games Sleeper no longer lists for the week so
     * their picks are never scored. The automation leaves a short answer from
     * Sleeper alone, where a dropped game would quietly void real bets.
     */
    removeStaleGames = false,
    /**
     * Whether a human pressed the button. An admin scoring a week hands it to
     * a human for good; the automation's own scoring leaves ownership alone.
     */
    byAdmin = false,
  }: { removeStaleGames?: boolean; byAdmin?: boolean } = {},
): Promise<ScoreLocksWeekResult> {
  const locksWeek = await getLocksWeekByYearAndWeek(year, weekNumber);
  if (!locksWeek) {
    return { scored: false, message: `There's no locks week here` };
  }

  await syncNflGameWeek(year, [weekNumber], { removeStaleGames });

  const allGamesCompleted = await areAllNflGamesComplete(year, weekNumber);
  if (!allGamesCompleted) {
    // An admin pressing Score on an incomplete week takes it over even though
    // scoring cannot proceed, so the automation cannot score it later.
    if (byAdmin) {
      await updateLocksWeek({ ...locksWeek, autoManaged: false });
    }
    return {
      scored: false,
      message: 'Not all games have been completed, scoring cannot proceed',
    };
  }

  const locksGames = await getLocksGamesByYearAndWeek(year, weekNumber);
  await Promise.all(
    locksGames.map(locksGame => updateLocksGamePicksWithResults(locksGame)),
  );
  await Promise.all(
    locksGames.map(locksGame => deleteLocksGamePicksNotActive(locksGame)),
  );

  await updateLocksWeek({
    ...locksWeek,
    isWeekScored: true,
    autoManaged: byAdmin ? false : locksWeek.autoManaged,
  });

  return { scored: true, message: 'Week has been scored' };
}

/**
 * The Locks Challenge half of the scoring phase. Only a week the automation
 * owns, that is not scored yet, is a candidate; the completeness guard lives in
 * the shared score function so the admin button and this path agree.
 */
export const locksChallengeScorer: SideGameScorer = {
  game: 'Locks Challenge',
  async scoreWeek(year: number, week: number) {
    const locksWeek: LocksWeek | null = await getLocksWeekByYearAndWeek(
      year,
      week,
    );
    if (!locksWeek || locksWeek.isWeekScored || !locksWeek.autoManaged) {
      return { status: 'skipped' };
    }

    const { scored } = await scoreLocksWeek(year, week);
    return scored ? { status: 'scored' } : { status: 'skipped' };
  },
};
