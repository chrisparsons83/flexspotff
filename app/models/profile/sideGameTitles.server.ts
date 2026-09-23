import type { SideGameKey } from './badges';
import {
  addTo,
  fSquaredEntryPoints,
  locksWeekPoints,
  qbStreamingSeasonTotal,
  winnersOf,
} from './sideGameScoring';
import { prisma } from '~/db.server';
import { getCurrentSeason } from '~/models/season.server';

/**
 * How many seasons of each side game a member has won.
 *
 * Each game is ranked exactly the way its own standings page ranks it - see
 * `sideGameScoring.ts` for the two rules that are not obvious. A badge that
 * disagreed with the standings page would be worse than no badge.
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
): Promise<SideGameTitles> {
  // Read once and threaded through, rather than six times inside the counters.
  const inProgress = (await getCurrentSeason())?.year ?? null;

  const [d12, qbStreaming, spreadPool, locks, dfsSurvivor, fSquared] =
    await Promise.all([
      countD12Titles(userId, inProgress),
      countQbStreamingTitles(userId, inProgress),
      countSpreadPoolTitles(userId, inProgress),
      countLocksTitles(userId, inProgress),
      countDfsSurvivorTitles(userId, inProgress),
      countFSquaredTitles(userId, inProgress),
    ]);

  return { d12, qbStreaming, spreadPool, locks, dfsSurvivor, fSquared };
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

  const scores = await prisma.d12WeekScore.findMany({
    where: { league: { season: { year: { in: years } } } },
    select: {
      userId: true,
      points: true,
      league: { select: { season: { select: { year: true } } } },
    },
  });

  const byYear = new Map<number, Map<string, number>>();
  for (const score of scores) {
    const year = score.league.season.year;
    if (!byYear.has(year)) byYear.set(year, new Map());
    addTo(byYear.get(year)!, score.userId, score.points ?? 0);
  }

  return countWins(byYear, userId, inProgress);
}

/**
 * QB Streaming: the best twelve weeks from 2025, every week before that.
 * `qbStreamingSeasonTotal` owns which rule applies.
 */
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

  const selections = await prisma.qBSelection.findMany({
    where: { qbStreamingWeek: { year: { in: years }, isScored: true } },
    select: {
      userId: true,
      qbStreamingWeek: { select: { year: true } },
      standardPlayer: { select: { pointsScored: true } },
      deepPlayer: { select: { pointsScored: true } },
    },
  });

  // Weeks are collected per member first, because whether they all count
  // depends on the season.
  const weeklyByYear = new Map<number, Map<string, number[]>>();
  for (const selection of selections) {
    const year = selection.qbStreamingWeek.year;
    if (!weeklyByYear.has(year)) weeklyByYear.set(year, new Map());
    const forYear = weeklyByYear.get(year)!;
    const week =
      selection.standardPlayer.pointsScored + selection.deepPlayer.pointsScored;
    forYear.set(selection.userId, [
      ...(forYear.get(selection.userId) ?? []),
      week,
    ]);
  }

  const byYear = new Map<number, Map<string, number>>();
  for (const [year, perUser] of weeklyByYear) {
    const totals = new Map<string, number>();
    for (const [entrant, weeks] of perUser) {
      totals.set(entrant, qbStreamingSeasonTotal(weeks, year));
    }
    byYear.set(year, totals);
  }

  return countWins(byYear, userId, inProgress);
}

/**
 * Spread Pool: net won and lost, including the penalty for a missed week.
 * Only bets that were actually placed and scored count, matching
 * `getPoolGamePicksWonLoss`.
 */
async function countSpreadPoolTitles(
  userId: string,
  inProgress: number | null,
): Promise<number> {
  const entered = await prisma.poolGamePick.findMany({
    where: { userId },
    select: { poolGame: { select: { poolWeek: { select: { year: true } } } } },
  });
  const years = distinct(
    entered
      .map(row => row.poolGame.poolWeek?.year)
      .filter((year): year is number => year !== undefined),
  );
  if (years.length === 0) return 0;

  const [picks, missed] = await Promise.all([
    prisma.poolGamePick.findMany({
      where: {
        isScored: true,
        amountBet: { gt: 0 },
        poolGame: { poolWeek: { year: { in: years } } },
      },
      select: {
        userId: true,
        resultWonLoss: true,
        poolGame: { select: { poolWeek: { select: { year: true } } } },
      },
    }),
    prisma.poolWeekMissed.findMany({
      where: { poolWeek: { year: { in: years } } },
      select: {
        userId: true,
        resultWonLoss: true,
        poolWeek: { select: { year: true } },
      },
    }),
  ]);

  const byYear = new Map<number, Map<string, number>>();
  const forYear = (year: number) => {
    if (!byYear.has(year)) byYear.set(year, new Map());
    return byYear.get(year)!;
  };

  for (const pick of picks) {
    const year = pick.poolGame.poolWeek?.year;
    if (year === undefined) continue;
    addTo(forYear(year), pick.userId, pick.resultWonLoss ?? 0);
  }
  for (const week of missed) {
    const year = week.poolWeek?.year;
    if (year === undefined) continue;
    addTo(forYear(year), week.userId, week.resultWonLoss ?? 0);
  }

  return countWins(byYear, userId, inProgress);
}

/** Locks: wins per week, but a week with any loss is worth nothing. */
async function countLocksTitles(
  userId: string,
  inProgress: number | null,
): Promise<number> {
  const entered = await prisma.locksGamePick.findMany({
    where: { userId },
    select: {
      locksGame: { select: { locksWeek: { select: { year: true } } } },
    },
  });
  const years = distinct(
    entered
      .map(row => row.locksGame.locksWeek?.year)
      .filter((year): year is number => year !== undefined),
  );
  if (years.length === 0) return 0;

  const picks = await prisma.locksGamePick.findMany({
    where: {
      isScored: true,
      locksGame: { locksWeek: { year: { in: years } } },
    },
    select: {
      userId: true,
      isWin: true,
      isLoss: true,
      locksGame: {
        select: { locksWeek: { select: { year: true, weekNumber: true } } },
      },
    },
  });

  // Wins and losses are tallied per member per week before scoring, because a
  // single loss voids the whole week.
  const weekly = new Map<string, { isWin: number; isLoss: number }>();
  for (const pick of picks) {
    const week = pick.locksGame.locksWeek;
    if (!week) continue;
    const key = `${week.year}:${week.weekNumber}:${pick.userId}`;
    const running = weekly.get(key) ?? { isWin: 0, isLoss: 0 };
    running.isWin += pick.isWin;
    running.isLoss += pick.isLoss;
    weekly.set(key, running);
  }

  const byYear = new Map<number, Map<string, number>>();
  for (const [key, totals] of weekly) {
    const [year, , entrant] = key.split(':');
    const yearNumber = Number(year);
    if (!byYear.has(yearNumber)) byYear.set(yearNumber, new Map());
    addTo(byYear.get(yearNumber)!, entrant, locksWeekPoints(totals));
  }

  return countWins(byYear, userId, inProgress);
}

/** DFS Survivor: points from scored weeks. */
async function countDfsSurvivorTitles(
  userId: string,
  inProgress: number | null,
): Promise<number> {
  const entered = await prisma.dFSSurvivorUserYear.findMany({
    where: { userId },
    select: { year: true },
  });
  const years = distinct(entered.map(row => row.year));
  if (years.length === 0) return 0;

  const weeks = await prisma.dFSSurvivorUserWeek.findMany({
    where: { year: { in: years }, isScored: true },
    select: {
      userId: true,
      year: true,
      entries: { select: { points: true } },
    },
  });

  const byYear = new Map<number, Map<string, number>>();
  for (const week of weeks) {
    if (!byYear.has(week.year)) byYear.set(week.year, new Map());
    const points = week.entries.reduce((sum, entry) => sum + entry.points, 0);
    addTo(byYear.get(week.year)!, week.userId, points);
  }

  return countWins(byYear, userId, inProgress);
}

/** F²: the combined points-for of the teams a member picked. */
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

  const entries = await prisma.fSquaredEntry.findMany({
    where: { year: { in: years } },
    select: {
      userId: true,
      year: true,
      teams: { select: { pointsFor: true } },
    },
  });

  const byYear = new Map<number, Map<string, number>>();
  for (const entry of entries) {
    if (!byYear.has(entry.year)) byYear.set(entry.year, new Map());
    addTo(
      byYear.get(entry.year)!,
      entry.userId,
      fSquaredEntryPoints(entry.teams),
    );
  }

  return countWins(byYear, userId, inProgress);
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
