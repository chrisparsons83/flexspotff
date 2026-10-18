import type { League, TeamGame } from '@prisma/client';
import { prisma } from '~/db.server';
import { regularSeasonWeeks } from '~/utils/seasonStructure';

export type { TeamGame } from '@prisma/client';

type TeamGameCreate = Omit<TeamGame, 'id'>;
type TeamGameUpsert = Omit<TeamGame, 'id'> & Partial<Pick<TeamGame, 'id'>>;

export async function getNewestWeekTeamGameByYear(year: League['year']) {
  return prisma.teamGame.aggregate({
    where: {
      team: {
        league: {
          year,
        },
      },
      pointsScored: {
        gt: 0,
      },
    },
    _max: {
      week: true,
    },
  });
}

export async function getTeamGameYearlyTotals(year: League['year']) {
  return prisma.teamGame.groupBy({
    where: {
      team: {
        league: {
          year,
        },
      },
      isRegularSeason: true,
    },
    by: ['teamId'],
    _sum: {
      pointsScored: true,
    },
    orderBy: {
      _sum: {
        pointsScored: 'desc',
      },
    },
  });
}

export async function getTeamGameMultiweekTotals(
  weeks: TeamGame['week'][],
  year: League['year'],
) {
  return prisma.teamGame.groupBy({
    where: {
      week: {
        in: weeks,
      },
      team: {
        league: {
          year,
        },
      },
    },
    by: ['teamId'],
    _sum: {
      pointsScored: true,
    },
    orderBy: {
      _sum: {
        pointsScored: 'desc',
      },
    },
  });
}

export async function getTeamGameMultiweekTotalsSeparated(
  weeks: TeamGame['week'][],
  year: League['year'],
) {
  return prisma.teamGame.findMany({
    where: {
      week: {
        in: weeks,
      },
      team: {
        league: {
          year,
        },
      },
    },
  });
}

export async function getTeamGamesByYearAndWeek(
  year: League['year'],
  week: TeamGame['week'],
) {
  return prisma.teamGame.findMany({
    where: {
      week,
      team: {
        league: {
          year,
        },
      },
    },
    orderBy: [
      {
        pointsScored: 'desc',
      },
    ],
    include: {
      team: {
        include: {
          league: true,
          user: true,
        },
      },
      startingPlayers: true,
    },
  });
}

export async function upsertTeamGame(teamGame: TeamGameUpsert) {
  if (teamGame.id) {
    return prisma.teamGame.update({
      where: {
        id: teamGame.id,
      },
      data: teamGame,
    });
  } else {
    return prisma.teamGame.create({
      data: teamGame,
    });
  }
}

export async function createTeamGame(teamGame: TeamGameCreate) {
  const connect = teamGame.starters
    ?.filter(starter => starter !== '0')
    .map(starter => ({ sleeperId: starter }));

  return prisma.teamGame.create({
    data: {
      ...teamGame,
      startingPlayers: {
        connect,
      },
    },
  });
}

export async function updateTeamGame(teamGame: Partial<TeamGame>) {
  const connect = teamGame.starters
    ?.filter(starter => starter !== '0')
    .map(starter => ({ sleeperId: starter }));

  return prisma.teamGame.update({
    where: {
      id: teamGame.id,
    },
    data: {
      ...teamGame,
      startingPlayers: {
        connect,
      },
    },
  });
}

/**
 * Re-marks a league's games as regular season or postseason from its current
 * playoff start week.
 *
 * `isRegularSeason` is written when a game is synced, from whatever boundary
 * the league had then. A league whose `playoffWeekStart` is synced or changed
 * afterwards would otherwise keep games filed on the wrong side of it, and
 * every page reading the column would disagree with the ones that work the
 * boundary out.
 */
export async function reclassifyRegularSeasonGames(
  league: Pick<League, 'id' | 'year' | 'playoffWeekStart'>,
) {
  const firstPostseasonWeek = regularSeasonWeeks(league) + 1;

  return prisma.$transaction([
    prisma.teamGame.updateMany({
      where: {
        team: { leagueId: league.id },
        week: { lt: firstPostseasonWeek },
        isRegularSeason: false,
      },
      data: { isRegularSeason: true },
    }),
    prisma.teamGame.updateMany({
      where: {
        team: { leagueId: league.id },
        week: { gte: firstPostseasonWeek },
        isRegularSeason: true,
      },
      data: { isRegularSeason: false },
    }),
  ]);
}
