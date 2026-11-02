import { buildDfsSeasonTotals } from './dfsSurvivorProfile';
import { buildSeasonTotals as buildLocksSeasonTotals } from './locksProfile';
import {
  addTo,
  fSquaredEntryPoints,
  qbStreamingSeasonTotal,
} from './sideGameScoring';
import { buildSeasonTotals as buildSpreadPoolSeasonTotals } from './spreadPoolProfile';
import { prisma } from '~/db.server';

/**
 * Every entrant's season total in each side game that is ranked by one, by
 * year: `Map<year, Map<userId, total>>`. Each is worked out exactly the way
 * the game's standings page ranks it - see `sideGameScoring.ts` for the two
 * rules that are not obvious - so the title badges, the profile finishes and
 * the game history pages cannot disagree.
 *
 * Pass `years` to rank only those seasons; leave it out for every season.
 */
export type SeasonTotals = Map<number, Map<string, number>>;

const inYears = (years: number[] | undefined) =>
  years ? { in: years } : undefined;

/** D12: total points across every league and week. */
export async function d12SeasonTotals(years?: number[]): Promise<SeasonTotals> {
  const scores = await prisma.d12WeekScore.findMany({
    where: { league: { season: { year: inYears(years) } } },
    select: {
      userId: true,
      points: true,
      league: { select: { season: { select: { year: true } } } },
    },
  });

  const byYear: SeasonTotals = new Map();
  for (const score of scores) {
    const year = score.league.season.year;
    if (!byYear.has(year)) byYear.set(year, new Map());
    addTo(byYear.get(year)!, score.userId, score.points ?? 0);
  }
  return byYear;
}

/**
 * QB Streaming: the best twelve weeks from 2025, every week before that.
 * `qbStreamingSeasonTotal` owns which rule applies.
 */
export async function qbStreamingSeasonTotals(
  years?: number[],
): Promise<SeasonTotals> {
  const selections = await prisma.qBSelection.findMany({
    where: { qbStreamingWeek: { year: inYears(years), isScored: true } },
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

  const byYear: SeasonTotals = new Map();
  for (const [year, perUser] of weeklyByYear) {
    const totals = new Map<string, number>();
    for (const [entrant, weeks] of perUser) {
      totals.set(entrant, qbStreamingSeasonTotal(weeks, year));
    }
    byYear.set(year, totals);
  }
  return byYear;
}

/**
 * Spread Pool: net won and lost, including the penalty for a missed week.
 * Only bets that were actually placed and scored count, matching
 * `getPoolGamePicksWonLoss`. A total is the net, not the bank; add
 * `STARTING_BANK` to show the bank.
 */
export async function spreadPoolSeasonTotals(
  years?: number[],
): Promise<SeasonTotals> {
  const [picks, missed] = await Promise.all([
    prisma.poolGamePick.findMany({
      where: {
        isScored: true,
        amountBet: { gt: 0 },
        poolGame: { poolWeek: { year: inYears(years) } },
      },
      select: {
        userId: true,
        resultWonLoss: true,
        poolGame: { select: { poolWeek: { select: { year: true } } } },
      },
    }),
    prisma.poolWeekMissed.findMany({
      where: { poolWeek: { year: inYears(years) } },
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

  return buildSpreadPoolSeasonTotals(
    picks.flatMap(pick =>
      seasonRow({ ...pick, poolWeek: pick.poolGame.poolWeek }),
    ),
    missed.flatMap(seasonRow),
  );
}

/** Locks: wins per week, but a week with any loss is worth nothing. */
export async function locksSeasonTotals(
  years?: number[],
): Promise<SeasonTotals> {
  const picks = await prisma.locksGamePick.findMany({
    where: {
      isScored: true,
      isActive: { gt: 0 },
      locksGame: { locksWeek: { year: inYears(years) } },
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
  return buildLocksSeasonTotals(
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
}

/** DFS Survivor: points from entries in scored weeks. */
export async function dfsSurvivorSeasonTotals(
  years?: number[],
): Promise<SeasonTotals> {
  const entries = await prisma.dFSSurvivorUserEntry.findMany({
    where: { year: inYears(years), userWeek: { isScored: true } },
    select: { userId: true, year: true, points: true },
  });
  return buildDfsSeasonTotals(entries);
}

/** F²: the combined points-for of the teams a member picked. */
export async function fSquaredSeasonTotals(
  years?: number[],
): Promise<SeasonTotals> {
  const entries = await prisma.fSquaredEntry.findMany({
    where: { year: inYears(years) },
    select: {
      userId: true,
      year: true,
      teams: { select: { pointsFor: true } },
    },
  });

  const byYear: SeasonTotals = new Map();
  for (const entry of entries) {
    if (!byYear.has(entry.year)) byYear.set(entry.year, new Map());
    addTo(
      byYear.get(entry.year)!,
      entry.userId,
      fSquaredEntryPoints(entry.teams),
    );
  }
  return byYear;
}

/** The seasons each game has weeks for, newest first, for year pickers. */
export async function sideGameYears(
  game: 'spreadPool' | 'locks' | 'dfsSurvivor' | 'qbStreaming' | 'fSquared',
): Promise<number[]> {
  const query = { distinct: 'year', select: { year: true } } as const;
  const rows =
    game === 'spreadPool'
      ? await prisma.poolWeek.findMany(query)
      : game === 'locks'
      ? await prisma.locksWeek.findMany(query)
      : game === 'dfsSurvivor'
      ? await prisma.dFSSurvivorUserWeek.findMany(query)
      : game === 'qbStreaming'
      ? await prisma.qBStreamingWeek.findMany(query)
      : await prisma.fSquaredEntry.findMany(query);
  return rows.map(row => row.year).sort((a, b) => b - a);
}
