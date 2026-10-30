import { prisma } from '~/db.server';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { locksWeekPoints } from '~/models/profile/sideGameScoring';
import { getQBSelectionsByWeek } from '~/models/qbselection.server';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { assignCompetitionRanks } from '~/utils/rank';

/** The weekly games, the ones with a week to look back on. */
export type WeeklyGame = 'qbStreaming' | 'spreadPool' | 'locks' | 'dfsSurvivor';

/** One member's result in a game's week, as the game scores it. */
export type WeekResult = {
  userId: string;
  rank: number;
  /** What the standings sort on. */
  score: number;
  /** As a member reads it: "30.24", "+40", "4 (5-1-0)". */
  label: string;
};

/** A game's newest scored week, everyone in it best first. */
export type LastWeek = { week: number; results: WeekResult[] };

const signed = (net: number) => (net > 0 ? `+${net}` : `${net}`);

const ranked = (week: number, rows: Omit<WeekResult, 'rank'>[]): LastWeek => ({
  week,
  results: assignCompetitionRanks(
    [...rows].sort((a, b) => b.score - a.score),
    row => row.score,
  ),
});

/** Each member's two quarterbacks in the newest scored week. */
async function qbStreaming(year: number) {
  const week = (await getQBStreamingWeeks(year)).find(
    qbWeek => qbWeek.isScored,
  );
  if (!week) return null;
  const selections = await getQBSelectionsByWeek(week.id);
  return ranked(
    week.week,
    selections.map(selection => {
      const score =
        selection.standardPlayer.pointsScored +
        selection.deepPlayer.pointsScored;
      return { userId: selection.userId, score, label: score.toFixed(2) };
    }),
  );
}

/** What each member won or lost in the newest scored week, missed too. */
async function spreadPool(year: number) {
  const week = (await getPoolWeeksByYear(year)).find(
    poolWeek => poolWeek.isWeekScored,
  );
  if (!week) return null;
  const [bets, missed] = await Promise.all([
    prisma.poolGamePick.groupBy({
      by: ['userId'],
      where: { amountBet: { gt: 0 }, poolGame: { poolWeekId: week.id } },
      _sum: { resultWonLoss: true },
    }),
    prisma.poolWeekMissed.groupBy({
      by: ['userId'],
      where: { poolWeekId: week.id },
      _sum: { resultWonLoss: true },
    }),
  ]);
  const nets = new Map<string, number>();
  for (const row of [...bets, ...missed]) {
    nets.set(
      row.userId,
      (nets.get(row.userId) ?? 0) + (row._sum.resultWonLoss ?? 0),
    );
  }
  const bettors = new Set(bets.map(row => row.userId));
  return ranked(
    week.weekNumber,
    [...nets].map(([userId, net]) => ({
      userId,
      score: net,
      label: `${signed(net)}${bettors.has(userId) ? '' : ', missed'}`,
    })),
  );
}

/** Each member's points and record in the newest scored week. */
async function locks(year: number) {
  const week = (await getLocksWeeksByYear(year)).find(
    locksWeek => locksWeek.isWeekScored,
  );
  if (!week) return null;
  // Only the picks that count: a pick switched to the other side, or to no
  // pick, stays in the table as inactive until the week is cleaned up.
  const rows = await prisma.locksGamePick.groupBy({
    by: ['userId'],
    where: {
      isActive: { gt: 0 },
      isScored: true,
      locksGame: { locksWeekId: week.id },
    },
    _sum: { isWin: true, isLoss: true, isTie: true },
  });
  return ranked(
    week.weekNumber,
    rows.map(({ userId, _sum: sum }) => {
      const score = locksWeekPoints(sum);
      return {
        userId,
        score,
        label: `${score} (${sum.isWin ?? 0}-${sum.isLoss ?? 0}-${
          sum.isTie ?? 0
        })`,
      };
    }),
  );
}

/** Each member's lineup in the newest scored DFS Survivor week. */
async function dfsSurvivor(year: number) {
  const newest = await prisma.dFSSurvivorUserWeek.findFirst({
    where: { year, isScored: true },
    orderBy: { week: 'desc' },
    select: { week: true },
  });
  if (!newest) return null;
  const weeks = await prisma.dFSSurvivorUserWeek.findMany({
    where: { year, week: newest.week, isScored: true },
    select: { userId: true, entries: { select: { points: true } } },
  });
  return ranked(
    newest.week,
    weeks.map(userWeek => {
      const score = userWeek.entries.reduce(
        (sum, entry) => sum + entry.points,
        0,
      );
      return { userId: userWeek.userId, score, label: score.toFixed(2) };
    }),
  );
}

const LOADERS: Record<WeeklyGame, (year: number) => Promise<LastWeek | null>> =
  { qbStreaming, spreadPool, locks, dfsSurvivor };

/**
 * Every weekly game's newest scored week this season, everyone in it ranked
 * the way the game's weekly standings rank it. Null for a game with no
 * scored week yet.
 */
export async function getLastWeeks(
  year: number,
): Promise<Record<WeeklyGame, LastWeek | null>> {
  const games = Object.keys(LOADERS) as WeeklyGame[];
  const weeks = await Promise.all(games.map(game => LOADERS[game](year)));
  return Object.fromEntries(games.map((game, i) => [game, weeks[i]])) as Record<
    WeeklyGame,
    LastWeek | null
  >;
}
