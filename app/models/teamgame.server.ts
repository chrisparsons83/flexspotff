import type { League, TeamGame } from '@prisma/client';

import { prisma } from '~/db.server';

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
) {
  return prisma.teamGame.findMany({
    where: {
      week: {
        in: weeks,
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
