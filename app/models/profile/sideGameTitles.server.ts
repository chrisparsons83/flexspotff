import type { SideGameKey } from './badges';
import { getLocksYears } from './locks.server';
import { winnersOf } from './sideGameScoring';
import {
  d12SeasonTotals,
  dfsSurvivorSeasonTotals,
  fSquaredSeasonTotals,
  locksSeasonTotals,
  qbStreamingSeasonTotals,
  spreadPoolSeasonTotals,
} from './sideGameSeasons.server';
import { getSpreadPoolYears } from './spreadPool.server';
import { prisma } from '~/db.server';

/**
 * How many seasons of each side game a member has won.
 *
 * Each game is ranked exactly the way its own standings page ranks it, by the
 * season totals in `sideGameSeasons.server.ts`. A badge that disagreed with
 * the standings page would be worse than no badge.
 *
 * Only the seasons a member actually entered are ranked. Working out who won
 * 2019 tells us nothing about someone who did not play that year, and skipping
 * those years keeps this off the critical path for most profiles.
 *
 * And only seasons that are over. Whoever leads in September has not won
 * anything yet, and a badge that appears in week 3 and vanishes in week 12 is
 * worse than one that arrives late.
 */
export type SideGameTitles = Partial<Record<SideGameKey, number>>;

export async function getSideGameTitles(
  userId: string,
  /** The season still being played - see `getSeasonState`. */
  inProgress: number | null,
): Promise<SideGameTitles> {
  const [
    d12,
    qbStreaming,
    spreadPool,
    locks,
    dfsSurvivor,
    guillotine,
    bestBall,
    survivor,
    fSquared,
  ] = await Promise.all([
    countD12Titles(userId, inProgress),
    countQbStreamingTitles(userId, inProgress),
    countSpreadPoolTitles(userId, inProgress),
    countLocksTitles(userId, inProgress),
    countDfsSurvivorTitles(userId, inProgress),
    countGuillotineTitles(userId),
    countBestBallTitles(userId),
    countSurvivorTitles(userId),
    countFSquaredTitles(userId, inProgress),
  ]);

  return {
    d12,
    qbStreaming,
    spreadPool,
    locks,
    dfsSurvivor,
    guillotine,
    bestBall,
    survivor,
    fSquared,
  };
}

/** Distinct values, so a member's seasons are only ranked once each. */
const distinct = (years: number[]) => [...new Set(years)];

/** D12: total points across every league and week. */
async function countD12Titles(
  userId: string,
  inProgress: number | null,
): Promise<number> {
  const entered = await prisma.d12WeekScore.findMany({
    where: { userId },
    select: { league: { select: { season: { select: { year: true } } } } },
  });
  const years = distinct(entered.map(row => row.league.season.year));
  if (years.length === 0) return 0;
  return countWins(await d12SeasonTotals(years), userId, inProgress);
}

/** QB Streaming: see `qbStreamingSeasonTotals`. */
async function countQbStreamingTitles(
  userId: string,
  inProgress: number | null,
): Promise<number> {
  const entered = await prisma.qBSelection.findMany({
    where: { userId },
    select: { qbStreamingWeek: { select: { year: true } } },
  });
  const years = distinct(entered.map(row => row.qbStreamingWeek.year));
  if (years.length === 0) return 0;
  return countWins(await qbStreamingSeasonTotals(years), userId, inProgress);
}

/** Spread Pool: see `spreadPoolSeasonTotals`. */
async function countSpreadPoolTitles(
  userId: string,
  inProgress: number | null,
): Promise<number> {
  const years = await getSpreadPoolYears(userId);
  if (years.length === 0) return 0;
  return countWins(await spreadPoolSeasonTotals(years), userId, inProgress);
}

/** Locks: see `locksSeasonTotals`. */
async function countLocksTitles(
  userId: string,
  inProgress: number | null,
): Promise<number> {
  const years = await getLocksYears(userId);
  if (years.length === 0) return 0;
  return countWins(await locksSeasonTotals(years), userId, inProgress);
}

/** DFS Survivor: see `dfsSurvivorSeasonTotals`. */
async function countDfsSurvivorTitles(
  userId: string,
  inProgress: number | null,
): Promise<number> {
  const entered = await prisma.dFSSurvivorUserEntry.findMany({
    where: { userId, userWeek: { isScored: true } },
    select: { year: true },
    distinct: ['year'],
  });
  const years = entered.map(row => row.year);
  if (years.length === 0) return 0;
  return countWins(await dfsSurvivorSeasonTotals(years), userId, inProgress);
}

/** F²: see `fSquaredSeasonTotals`. */
async function countFSquaredTitles(
  userId: string,
  inProgress: number | null,
): Promise<number> {
  const entered = await prisma.fSquaredEntry.findMany({
    where: { userId },
    select: { year: true },
  });
  const years = distinct(entered.map(row => row.year));
  if (years.length === 0) return 0;
  return countWins(await fSquaredSeasonTotals(years), userId, inProgress);
}

/**
 * How many of these finished seasons the member topped.
 *
 * The season still being played is skipped, along with anything later. Leading
 * a side game in week 3 is not winning it, and the whole point of these badges
 * is that they are settled.
 */
function countWins(
  byYear: Map<number, Map<string, number>>,
  userId: string,
  inProgress: number | null,
): number {
  let titles = 0;
  for (const [year, totals] of byYear) {
    if (inProgress !== null && year >= inProgress) continue;
    if (winnersOf(totals).has(userId)) titles++;
  }
  return titles;
}

/**
 * Guillotine: last team standing. There is no ranking to redo here - the sync
 * only records a champion once week 17 has settled it, so a live season can
 * never award one early.
 */
async function countGuillotineTitles(userId: string): Promise<number> {
  return prisma.guillotineTeam.count({ where: { userId, finish: 1 } });
}

/**
 * Best ball: like the guillotine, sync only settles a finish once week 17 is
 * final, so a stored first place is a season that is over.
 */
async function countBestBallTitles(userId: string): Promise<number> {
  return prisma.bestBallTeam.count({ where: { userId, finish: 1 } });
}

/**
 * Survivor: a finish is only written once a pool is decided, so a stored
 * first place is a pool won. Co-winners each count it.
 */
async function countSurvivorTitles(userId: string): Promise<number> {
  return prisma.survivorEntry.count({ where: { userId, finish: 1 } });
}
