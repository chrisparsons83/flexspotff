import { prisma } from '~/db.server';
import { getCurrentSeason } from '~/models/season.server';
import {
  NO_SEASON_IN_PROGRESS,
  seasonStateFromSchedule,
  type SeasonState,
} from '~/utils/seasonStructure';

export type { SeasonState } from '~/utils/seasonStructure';

/**
 * The one answer to "is a season being played, and how far through is it".
 *
 * Every profile tab, the profile hero and the bracket sync read this rather
 * than `Season.isCurrent` on its own - see `SeasonState` for why the two
 * differ.
 */
export async function getSeasonState(now = new Date()): Promise<SeasonState> {
  const season = await getCurrentSeason();
  if (!season) return NO_SEASON_IN_PROGRESS;

  const weeks = await prisma.nFLGame.groupBy({
    by: ['week'],
    where: { year: season.year },
    _max: { gameStartTime: true },
  });

  return seasonStateFromSchedule({
    year: season.year,
    lastKickoffByWeek: weeks.flatMap(week =>
      week._max.gameStartTime
        ? [{ week: week.week, lastKickoff: week._max.gameStartTime }]
        : [],
    ),
    now,
  });
}

/** The season still being played, or null when none is. */
export async function getInProgressYear(): Promise<number | null> {
  return (await getSeasonState()).inProgressYear;
}
