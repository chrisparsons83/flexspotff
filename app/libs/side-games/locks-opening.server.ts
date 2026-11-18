import type { SideGameOpener } from './types';
import { sideGameWeekOpensAt } from './weeks';
import {
  createAndOpenLocksWeek,
  getLocksWeekByYearAndWeek,
  openLocksWeekWithGames,
} from '~/models/locksweek.server';
import { getWeekNflGames } from '~/models/nflgame.server';
import { LAST_AUTOMATED_WEEK } from '~/utils/helpers';

/**
 * The Locks Challenge half of the opening phase.
 *
 * A week opens at 8am Eastern on the Tuesday before its first kickoff, derived
 * from that kickoff so a Wednesday or Saturday game is still open in time. It
 * is left alone once its first game has kicked off, when it is already open or
 * scored, and when an admin owns it: any admin action hands the week to a human
 * and the automation never takes it back.
 *
 * Creating and opening are single transactions in the model layer, so a crash
 * cannot leave a closed week with no games behind for the next run to trip on.
 */
export const locksChallengeOpener: SideGameOpener = {
  game: 'Locks Challenge',
  async openWeek(year, week, firstGameStart, now) {
    if (week > LAST_AUTOMATED_WEEK) return { status: 'skipped' };
    if (firstGameStart <= now) return { status: 'skipped' };
    if (now < sideGameWeekOpensAt(firstGameStart)) {
      return { status: 'skipped' };
    }

    const existing = await getLocksWeekByYearAndWeek(year, week);
    if (
      existing &&
      (existing.isOpen || existing.isWeekScored || !existing.autoManaged)
    ) {
      return { status: 'skipped' };
    }

    const nflGames = await getWeekNflGames(year, week);
    if (nflGames.length === 0) return { status: 'skipped' };
    const nflGameIds = nflGames.map(game => game.id);

    if (existing) {
      await openLocksWeekWithGames(existing, nflGameIds);
    } else {
      await createAndOpenLocksWeek(year, week, nflGameIds);
    }

    return { status: 'opened' };
  },
};
