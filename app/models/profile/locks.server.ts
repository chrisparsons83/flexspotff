import {
  buildFieldRace,
  buildLocksCareer,
  buildLocksPicks,
  buildLocksSeasons,
  buildLocksSplits,
  buildLocksTeams,
  buildLocksWeeks,
  buildRiskProfile,
  buildSeasonTotals,
  type LocksPickRow,
  type PickResult,
} from './locksProfile';
import { prisma } from '~/db.server';
import { getInProgressYear } from '~/models/seasonState.server';

/**
 * Only picks that count. Scoring deletes the inactive rows saved against the
 * sides not picked, but an unscored week still has them.
 */
const countedPick = { isScored: true, isActive: { gt: 0 } } as const;

const resultOf = (pick: { isWin: number; isLoss: number }): PickResult =>
  pick.isWin ? 'win' : pick.isLoss ? 'loss' : 'tie';

/**
 * Every scored pick for the given seasons, from the whole field.
 *
 * A pick is only scored once its week is, so the open week - whose picks stay
 * hidden on the standings page until kickoff - never shows up here.
 */
export async function loadLocksRows(years: number[]) {
  const [picks, teams] = await Promise.all([
    prisma.locksGamePick.findMany({
      where: {
        ...countedPick,
        locksGame: { locksWeek: { year: { in: years } } },
      },
      select: {
        userId: true,
        isWin: true,
        isLoss: true,
        teamBetId: true,
        locksGame: {
          select: {
            gameId: true,
            locksWeek: { select: { year: true, weekNumber: true } },
            game: {
              select: {
                homeTeamId: true,
                awayTeamId: true,
                homeTeamScore: true,
                awayTeamScore: true,
                gameStartTime: true,
                // Locks has no line; the Spread Pool's on the same game says
                // who was favored.
                poolGame: { select: { homeSpread: true } },
              },
            },
          },
        },
      },
    }),
    prisma.nFLTeam.findMany({
      select: { id: true, sleeperId: true, name: true },
    }),
  ]);

  // Sleeper's team IDs are the abbreviations.
  const abbreviations = new Map(teams.map(team => [team.id, team.sleeperId]));
  const abbreviationOf = (id: string) => abbreviations.get(id) ?? '?';

  const rows: LocksPickRow[] = picks.flatMap(pick => {
    const { locksWeek, game, gameId } = pick.locksGame;
    if (!locksWeek) return [];

    const isHome = pick.teamBetId === game.homeTeamId;
    const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
    const homeSpread = game.poolGame?.homeSpread;
    return [
      {
        userId: pick.userId,
        year: locksWeek.year,
        week: locksWeek.weekNumber,
        gameId,
        result: resultOf(pick),
        team: abbreviationOf(pick.teamBetId),
        opponent: abbreviationOf(opponentId),
        isHome,
        spread:
          homeSpread === undefined ? null : isHome ? homeSpread : -homeSpread,
        teamScore: isHome ? game.homeTeamScore : game.awayTeamScore,
        opponentScore: isHome ? game.awayTeamScore : game.homeTeamScore,
        kickoff: game.gameStartTime,
      },
    ];
  });

  const teamNames: Record<string, string> = Object.fromEntries(
    teams.map(team => [team.sleeperId, team.name]),
  );

  return { rows, teamNames };
}

/** The seasons a member has at least one scored pick in. */
export async function getLocksYears(userId: string): Promise<number[]> {
  const entered = await prisma.locksGamePick.findMany({
    where: { userId, ...countedPick },
    select: {
      locksGame: { select: { locksWeek: { select: { year: true } } } },
    },
  });
  return Array.from(
    new Set(
      entered
        .map(row => row.locksGame.locksWeek?.year)
        .filter((year): year is number => year !== undefined),
    ),
  );
}

/**
 * Everything the Locks tab shows.
 *
 * The whole field is loaded for the seasons the member played, because most
 * of the tab is measured against it: each week's rank, each season's finish,
 * the field's totals behind the member's on the race chart, and the field's
 * record on every kind of pick.
 */
export async function getLocksProfile(userId: string) {
  const years = await getLocksYears(userId);
  if (years.length === 0) return { hasPlayed: false as const };

  const [{ rows, teamNames }, inProgressYear] = await Promise.all([
    loadLocksRows(years),
    getInProgressYear(),
  ]);

  const picks = buildLocksPicks(rows, userId);
  const weeks = buildLocksWeeks({ picks, rows, userId });
  const fieldRaces = new Map(
    years.map(year => [
      year,
      buildFieldRace(rows.filter(row => row.year === year)),
    ]),
  );
  const seasons = buildLocksSeasons({
    weeks,
    totals: buildSeasonTotals(rows),
    fieldRaces,
    userId,
    inProgressYear,
  });

  return {
    hasPlayed: true as const,
    career: buildLocksCareer(seasons),
    seasons,
    risk: buildRiskProfile(weeks, rows, userId),
    splits: buildLocksSplits(picks, rows, userId),
    teams: buildLocksTeams(weeks),
    teamNames,
  };
}
