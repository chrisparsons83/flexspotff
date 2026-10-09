import { prisma } from '~/db.server';
import { getCurrentSeason } from '~/models/season.server';
import {
  NO_SEASON_IN_PROGRESS,
  nflRegularSeasonWeeks,
  seasonStateFromSchedule,
  type SeasonState,
} from '~/utils/seasonStructure';

export type { SeasonState } from '~/utils/seasonStructure';

/**
 * How long one answer is reused. A profile page runs its hero and its tab as
 * separate loaders, each wanting the same answer; this makes that one pair of
 * queries rather than one per loader, and a minute is far finer than anything
 * it describes changes.
 */
const CACHE_MS = 60 * 1000;

let cached: { at: number; state: Promise<SeasonState> } | null = null;

/**
 * The one answer to "is a season being played, and how far through is it".
 *
 * Every profile tab and the profile hero read this rather than
 * `Season.isCurrent` on its own - see `SeasonState` for why the two differ.
 */
export function getSeasonState(): Promise<SeasonState> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.state;

  const state = computeSeasonState(new Date(now));
  cached = { at: now, state };
  // A failed lookup is not an answer worth keeping for a minute.
  state.catch(() => {
    if (cached?.state === state) cached = null;
  });
  return state;
}

/** The season still being played, or null when none is. */
export async function getInProgressYear(): Promise<number | null> {
  return (await getSeasonState()).inProgressYear;
}

async function computeSeasonState(now: Date): Promise<SeasonState> {
  const season = await getCurrentSeason();
  if (!season) return NO_SEASON_IN_PROGRESS;

  const weeks = await prisma.nFLGame.groupBy({
    by: ['week'],
    where: { year: season.year },
    _max: { gameStartTime: true },
  });
  const lastKickoffByWeek = weeks.flatMap(week =>
    week._max.gameStartTime
      ? [{ week: week.week, lastKickoff: week._max.gameStartTime }]
      : [],
  );

  const fromSchedule = seasonStateFromSchedule({
    year: season.year,
    lastKickoffByWeek,
    scoringPending: false,
    now,
  });
  // Still running on the calendar alone: no need to ask about scoring.
  if (fromSchedule.inProgressYear !== null) return fromSchedule;

  return seasonStateFromSchedule({
    year: season.year,
    lastKickoffByWeek,
    scoringPending: await sideGameScoringPending(season.year),
    now,
  });
}

/**
 * Whether any side game is still waiting on an admin to score its final weeks.
 *
 * Only the last two NFL weeks are checked, where every side game ends. A pick
 * from week 3 that was never scored should not hold a season open forever.
 */
async function sideGameScoringPending(year: number): Promise<boolean> {
  const fromWeek = nflRegularSeasonWeeks(year) - 1;
  const unscored = { OR: [{ isScored: false }, { isScored: null }] };
  const finalWeeks = { game: { year, week: { gte: fromWeek } } };

  const counts = await Promise.all([
    prisma.locksGamePick.count({
      where: { ...unscored, isActive: { gt: 0 }, locksGame: finalWeeks },
    }),
    prisma.poolGamePick.count({
      where: { ...unscored, amountBet: { gt: 0 }, poolGame: finalWeeks },
    }),
    prisma.qBStreamingWeek.count({
      where: {
        year,
        week: { gte: fromWeek },
        isScored: false,
        QBSelections: { some: {} },
      },
    }),
    prisma.dFSSurvivorUserEntry.count({
      where: { year, week: { gte: fromWeek }, isScored: false },
    }),
  ]);

  return counts.some(count => count > 0);
}
