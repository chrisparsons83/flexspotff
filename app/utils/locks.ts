import { DateTime } from 'luxon';

export const LOCKS_TIME_ZONE = 'America/New_York';
export const LOCKS_CUTOFF_HOUR_ET = 13;

/**
 * Picks for a locks week freeze at 1PM ET on that week's Sunday, including for
 * the Sunday night and Monday night games that have not kicked off yet.
 *
 * The cutoff is derived from the week's own games so it always lands on the
 * Sunday of that slate, no matter which day the week opens on (Thursday
 * normally, but Wednesday for Christmas weeks and Saturday for week 18).
 *
 * Pass the week's full game list, not a subset derived from picks: scoring
 * deletes the inactive pick rows, so a pick-derived slate can be missing the
 * early games the cutoff is measured from.
 *
 * Returns null if there are no games, which means the week never locks by this
 * rule.
 */
export function getLocksWeekCutoff(
  games: { gameStartTime: Date }[],
): Date | null {
  if (games.length === 0) return null;

  const firstGameStartTime = games.reduce(
    (earliest, game) =>
      game.gameStartTime < earliest ? game.gameStartTime : earliest,
    games[0].gameStartTime,
  );

  const firstGame =
    DateTime.fromJSDate(firstGameStartTime).setZone(LOCKS_TIME_ZONE);

  // Luxon weekdays run Monday=1 through Sunday=7, so this is 0 days when the
  // week opens on a Sunday and otherwise moves forward to that week's Sunday.
  const daysUntilSunday = (7 - firstGame.weekday) % 7;

  return firstGame
    .plus({ days: daysUntilSunday })
    .set({
      hour: LOCKS_CUTOFF_HOUR_ET,
      minute: 0,
      second: 0,
      millisecond: 0,
    })
    .toJSDate();
}

export function isLocksWeekLocked(cutoff: Date | null, now: Date): boolean {
  return cutoff !== null && now >= cutoff;
}
