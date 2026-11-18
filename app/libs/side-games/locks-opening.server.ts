import type { SideGameOpener, SideGameOpenOutcome } from './types';
import { automationLeavesWeekAlone, sideGameWeekIsDue } from './weeks';
import { postAdminAlert } from '~/libs/admin-alerts.server';
import {
  createAndOpenLocksWeek,
  getLocksWeekByYearAndWeek,
  markLocksWeekOpenAlerted,
  openLocksWeekWithGames,
} from '~/models/locksweek.server';
import type { LocksWeek } from '~/models/locksweek.server';
import { getWeekNflGames } from '~/models/nflgame.server';

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
 * A closed week the automation already made can still fail its opening
 * transaction; that posts one alert naming the error and records
 * `openAlertedAt`, so later runs retry quietly. A successful open clears the
 * marker.
 */
export const locksChallengeOpener: SideGameOpener = {
  game: 'Locks Challenge',
  async openWeek(year, week, firstGameStart, now) {
    if (!sideGameWeekIsDue(week, firstGameStart, now)) {
      return { status: 'skipped' };
    }

    const existing = await getLocksWeekByYearAndWeek(year, week);
    if (automationLeavesWeekAlone(existing)) return { status: 'skipped' };

    const nflGames = await getWeekNflGames(year, week);
    if (nflGames.length === 0) return { status: 'skipped' };
    const nflGameIds = nflGames.map(game => game.id);

    if (existing) {
      try {
        await openLocksWeekWithGames(existing, nflGameIds);
      } catch (error) {
        return failOpen(existing, week, errorMessage(error));
      }
    } else {
      // There is no week row to record a first-failure marker on, so let the
      // job report the failure instead.
      await createAndOpenLocksWeek(year, week, nflGameIds);
    }

    return { status: 'opened' };
  },
};

/**
 * Posts the one alert for a failed open of an existing week and records it.
 * The marker is set only when the post returned: a Discord outage must leave it
 * unset so the next run retries the alert.
 */
async function failOpen(
  locksWeek: LocksWeek,
  week: number,
  reason: string,
): Promise<SideGameOpenOutcome> {
  if (locksWeek.openAlertedAt) return { status: 'skipped' };

  let posted = false;
  let warning: string | undefined;
  try {
    const result = await postAdminAlert(
      `**Locks Challenge** week ${week} failed to open: ${reason}`,
    );
    if (result.status === 'skipped') console.warn(result.reason);
    posted = true;
  } catch (error) {
    warning = `Admin alert failed for Locks Challenge week ${week}: ${errorMessage(
      error,
    )}`;
  }

  if (posted) await markLocksWeekOpenAlerted(locksWeek);
  return warning ? { status: 'skipped', warning } : { status: 'skipped' };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
