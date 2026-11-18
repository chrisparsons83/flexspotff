import { DateTime } from 'luxon';
import { LAST_AUTOMATED_WEEK } from '~/utils/helpers';

const EASTERN = 'America/New_York';

/**
 * When a week's side games open: 8am Eastern on the Tuesday before its first
 * kickoff, or on the day itself if the first game is on a Tuesday.
 *
 * Derived from the kickoff rather than a fixed weekday so a week with a
 * Wednesday or Saturday game opens before it; Luxon resolves the wall-clock
 * hour in Eastern time, so both DST changes stay at 8am local.
 */
export function sideGameWeekOpensAt(firstGameStart: Date): Date {
  const kickoff = DateTime.fromJSDate(firstGameStart).setZone(EASTERN);
  return kickoff
    .minus({ days: (kickoff.weekday - 2 + 7) % 7 })
    .set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
    .toJSDate();
}

/** The first NFL week a weekly side game's automation touches. */
export const FIRST_AUTOMATED_WEEK = 1;

/**
 * The weeks the scoring phase considers: this NFL week and the one before,
 * deduplicated and newest first.
 *
 * Looking back one week means a missed Monday heals on the next run, while
 * looking no further stops an abandoned September week from coming back to
 * life with penalties attached. Week 18 and the playoffs are never scored.
 */
export function scoringCandidateWeeks(currentWeek: number | null): number[] {
  if (currentWeek === null) return [];

  return [...new Set([currentWeek, currentWeek - 1])]
    .filter(week => week >= FIRST_AUTOMATED_WEEK && week <= LAST_AUTOMATED_WEEK)
    .sort((a, b) => b - a);
}
