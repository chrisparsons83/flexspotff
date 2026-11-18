import type { SideGameScorer } from './types';
import type { PoolWeek } from '@prisma/client';
import { syncNflGameWeek } from '~/libs/syncs.server';
import { getPoolGamesByYearAndWeek } from '~/models/poolgame.server';
import {
  getPoolGamePicksWonLoss,
  getPoolGamesPicksByPoolWeek,
  updatePoolGamePicksWithResults,
} from '~/models/poolgamepicks.server';
import {
  getPoolWeekByYearAndWeek,
  updatePoolWeek,
} from '~/models/poolweek.server';
import { createPoolWeekMissed } from '~/models/poolweekmissed.server';
import { areAllNflGamesComplete } from '~/utils/helpers';

export type ScorePoolWeekResult = {
  scored: boolean;
  message: string;
  /** How many missed-week penalty rows this score wrote. */
  missedWeekPenalties: number;
};

/**
 * Scores one Spread Pool week, shared by the admin Score Week button and the
 * weekly automation so the two cannot drift apart.
 *
 * The pool picks are read before the stored slate is synced, because the sync
 * drops picks on games that are no longer in the week: a member who bet on one
 * of those still entered, so must not then earn a missed-week penalty.
 *
 * Scoring refuses until every game of the week is complete, writes a
 * missed-week penalty for every member who did not bet, marks each game's picks
 * won or lost, and finally marks the week scored.
 */
export async function scorePoolWeek(
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
): Promise<ScorePoolWeekResult> {
  const poolWeek = await getPoolWeekByYearAndWeek(year, weekNumber);
  if (!poolWeek) {
    return {
      scored: false,
      message: `There's no pool week here`,
      missedWeekPenalties: 0,
    };
  }

  const poolGamePicks = await getPoolGamesPicksByPoolWeek(poolWeek);

  await syncNflGameWeek(year, [weekNumber], { removeStaleGames });

  const allGamesCompleted = await areAllNflGamesComplete(year, weekNumber);
  if (!allGamesCompleted) {
    // An admin pressing Score on an incomplete week takes it over even though
    // scoring cannot proceed, so the automation cannot score it later.
    if (byAdmin) {
      await updatePoolWeek({ ...poolWeek, autoManaged: false });
    }
    return {
      scored: false,
      message: 'Not all games have been completed, scoring cannot proceed',
      missedWeekPenalties: 0,
    };
  }

  const userIdsThatBet = [
    ...new Set(
      poolGamePicks
        .filter(poolGamePick => poolGamePick.amountBet > 0)
        .map(poolGamePick => poolGamePick.userId),
    ),
  ];
  const existingUserIdsThatDidNotBet = (await getPoolGamePicksWonLoss(year))
    .map(result => result.userId)
    .filter(userId => !userIdsThatBet.includes(userId));

  await Promise.all(
    existingUserIdsThatDidNotBet.map(userId =>
      createPoolWeekMissed(userId, poolWeek.id),
    ),
  );

  const poolGames = await getPoolGamesByYearAndWeek(year, weekNumber);
  await Promise.all(
    poolGames.map(poolGame => updatePoolGamePicksWithResults(poolGame)),
  );

  await updatePoolWeek({
    ...poolWeek,
    isWeekScored: true,
    autoManaged: byAdmin ? false : poolWeek.autoManaged,
  });

  return {
    scored: true,
    message: 'Week has been scored',
    missedWeekPenalties: existingUserIdsThatDidNotBet.length,
  };
}

/**
 * The Spread Pool half of the scoring phase. Only a week the automation owns,
 * that is not scored yet, is a candidate; the completeness guard lives in the
 * shared score function so the admin button and this path agree.
 */
export const poolScorer: SideGameScorer = {
  game: 'Spread Pool',
  async scoreWeek(year: number, week: number) {
    const poolWeek: PoolWeek | null = await getPoolWeekByYearAndWeek(
      year,
      week,
    );
    if (!poolWeek || poolWeek.isWeekScored || !poolWeek.autoManaged) {
      return { status: 'skipped' };
    }

    const { scored, missedWeekPenalties } = await scorePoolWeek(year, week);
    if (!scored) return { status: 'skipped' };

    return {
      status: 'scored',
      detail: `${missedWeekPenalties} missed-week penalties written`,
    };
  },
};
