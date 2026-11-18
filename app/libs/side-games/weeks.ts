import { LAST_AUTOMATED_WEEK } from '~/utils/helpers';

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
