import {
  buildFieldBanks,
  buildPoolBets,
  buildPoolCareer,
  buildPoolSeasons,
  buildPoolSplits,
  buildPoolTeams,
  buildPoolWeeks,
  buildSeasonTotals,
  type BetResult,
  type PoolBetRow,
  type PoolMissedRow,
} from './spreadPoolProfile';
import { prisma } from '~/db.server';
import { getCurrentSeason } from '~/models/season.server';

/**
 * Only bets with something riding on them. Every entry also saves a 0 against
 * each side it skipped, and scoring marks those won or lost too.
 */
const placedBet = { amountBet: { gt: 0 }, isScored: true } as const;

const resultOf = (pick: { isWin: number; isLoss: number }): BetResult =>
  pick.isWin ? 'win' : pick.isLoss ? 'loss' : 'push';

/**
 * Every scored bet and missed-week penalty for the given seasons, from the
 * whole field.
 *
 * A week is scored in one go, games and penalties together, so a bet's own
 * `isScored` is enough to keep the open week out - its bets stay hidden on the
 * standings page until kickoff, and a profile is no place to leak them.
 */
export async function loadSpreadPoolRows(years: number[]) {
  const [picks, missed, teams] = await Promise.all([
    prisma.poolGamePick.findMany({
      where: { ...placedBet, poolGame: { poolWeek: { year: { in: years } } } },
      select: {
        userId: true,
        amountBet: true,
        resultWonLoss: true,
        isWin: true,
        isLoss: true,
        teamBetId: true,
        poolGame: {
          select: {
            gameId: true,
            homeSpread: true,
            poolWeek: { select: { year: true, weekNumber: true } },
            game: {
              select: {
                homeTeamId: true,
                awayTeamId: true,
                homeTeamScore: true,
                awayTeamScore: true,
                gameStartTime: true,
              },
            },
          },
        },
      },
    }),
    prisma.poolWeekMissed.findMany({
      where: { poolWeek: { year: { in: years } } },
      select: {
        userId: true,
        resultWonLoss: true,
        poolWeek: { select: { year: true, weekNumber: true } },
      },
    }),
    prisma.nFLTeam.findMany({
      select: { id: true, sleeperId: true, name: true },
    }),
  ]);

  // Sleeper's team IDs are the abbreviations.
  const abbreviations = new Map(teams.map(team => [team.id, team.sleeperId]));
  const abbreviationOf = (id: string) => abbreviations.get(id) ?? '?';

  const rows: PoolBetRow[] = picks.flatMap(pick => {
    const { poolWeek, game, homeSpread, gameId } = pick.poolGame;
    if (!poolWeek) return [];

    const isHome = pick.teamBetId === game.homeTeamId;
    const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
    return [
      {
        userId: pick.userId,
        year: poolWeek.year,
        week: poolWeek.weekNumber,
        gameId,
        amount: pick.amountBet,
        net: pick.resultWonLoss ?? 0,
        result: resultOf(pick),
        team: abbreviationOf(pick.teamBetId),
        opponent: abbreviationOf(opponentId),
        isHome,
        spread: isHome ? homeSpread : -homeSpread,
        teamScore: isHome ? game.homeTeamScore : game.awayTeamScore,
        opponentScore: isHome ? game.awayTeamScore : game.homeTeamScore,
        kickoff: game.gameStartTime,
      },
    ];
  });

  const missedRows: PoolMissedRow[] = missed.flatMap(week =>
    week.poolWeek
      ? [
          {
            userId: week.userId,
            year: week.poolWeek.year,
            week: week.poolWeek.weekNumber,
            net: week.resultWonLoss ?? 0,
          },
        ]
      : [],
  );

  const teamNames: Record<string, string> = Object.fromEntries(
    teams.map(team => [team.sleeperId, team.name]),
  );

  return { rows, missed: missedRows, teamNames };
}

/** The seasons a member placed at least one scored bet in. */
export async function getSpreadPoolYears(userId: string): Promise<number[]> {
  const entered = await prisma.poolGamePick.findMany({
    where: { userId, ...placedBet },
    select: { poolGame: { select: { poolWeek: { select: { year: true } } } } },
  });
  return Array.from(
    new Set(
      entered
        .map(row => row.poolGame.poolWeek?.year)
        .filter((year): year is number => year !== undefined),
    ),
  );
}

/**
 * Everything the Spread Pool tab shows.
 *
 * The whole field is loaded for the seasons the member played, because most
 * of the tab is measured against it: each week's rank, each season's finish,
 * the field's banks behind the member's on the chart, and the field's record
 * on every kind of bet.
 */
export async function getSpreadPoolProfile(userId: string) {
  const years = await getSpreadPoolYears(userId);
  if (years.length === 0) return { hasPlayed: false as const };

  const [{ rows, missed, teamNames }, currentSeason] = await Promise.all([
    loadSpreadPoolRows(years),
    getCurrentSeason(),
  ]);

  const bets = buildPoolBets(rows, userId);
  const weeks = buildPoolWeeks({ bets, rows, missed, userId });
  const fieldBanks = new Map(
    years.map(year => [
      year,
      buildFieldBanks(
        rows.filter(row => row.year === year),
        missed.filter(week => week.year === year),
      ),
    ]),
  );
  const seasons = buildPoolSeasons({
    weeks,
    totals: buildSeasonTotals(rows, missed),
    fieldBanks,
    userId,
    inProgressYear: currentSeason?.year ?? null,
  });

  return {
    hasPlayed: true as const,
    career: buildPoolCareer(seasons),
    seasons,
    teams: buildPoolTeams(bets),
    teamNames,
    splits: buildPoolSplits(bets, rows, userId),
  };
}
