import type { SideGameKey } from './badges';
import { getLocksYears } from './locks.server';
import { buildSeasonTotals as buildLocksSeasonTotals } from './locksProfile';
import {
  addTo,
  fSquaredEntryPoints,
  qbStreamingSeasonTotal,
  winnersOf,
} from './sideGameScoring';
import { getSpreadPoolYears } from './spreadPool.server';
import { buildSeasonTotals } from './spreadPoolProfile';
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

  const [
    d12,
    qbStreaming,
    spreadPool,
    locks,
    dfsSurvivor,
    guillotine,
    bestBall,
    fSquared,
  ] = await Promise.all([
    countD12Titles(userId, inProgress),
    countQbStreamingTitles(userId, inProgress),
    countSpreadPoolTitles(userId, inProgress),
    countLocksTitles(userId, inProgress),
    countDfsSurvivorTitles(userId, inProgress),
    countGuillotineTitles(userId),
    countBestBallTitles(userId),
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
 * `getPoolGamePicksWonLoss`. Totalled by `buildSeasonTotals`, so the badge and
 * the finishes on the Spread Pool tab cannot disagree.
 */
async function countSpreadPoolTitles(
  userId: string,
  inProgress: number | null,
): Promise<number> {
  const years = await getSpreadPoolYears(userId);
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

  // Rows whose week has gone missing have no season to count toward.
  const seasonRow = (row: {
    userId: string;
    resultWonLoss: number | null;
    poolWeek: { year: number } | null;
  }) =>
    row.poolWeek
      ? [
          {
            userId: row.userId,
            year: row.poolWeek.year,
            net: row.resultWonLoss ?? 0,
          },
        ]
      : [];

  return countWins(
    buildSeasonTotals(
      picks.flatMap(pick =>
        seasonRow({ ...pick, poolWeek: pick.poolGame.poolWeek }),
      ),
      missed.flatMap(seasonRow),
    ),
    userId,
    inProgress,
  );
}

/** Locks: wins per week, but a week with any loss is worth nothing. */
async function countLocksTitles(
  userId: string,
  inProgress: number | null,
): Promise<number> {
  const years = await getLocksYears(userId);
  if (years.length === 0) return 0;

  const picks = await prisma.locksGamePick.findMany({
    where: {
      isScored: true,
      isActive: { gt: 0 },
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

  // Totalled week by week before the season, since a single loss voids the
  // whole week - buildSeasonTotals owns that, shared with the Locks tab.
  const totals = buildLocksSeasonTotals(
    picks.flatMap(pick => {
      const week = pick.locksGame.locksWeek;
      if (!week) return [];
      return [
        {
          userId: pick.userId,
          year: week.year,
          week: week.weekNumber,
          result: pick.isWin
            ? ('win' as const)
            : pick.isLoss
            ? ('loss' as const)
            : ('tie' as const),
        },
      ];
    }),
  );

  return countWins(totals, userId, inProgress);
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
