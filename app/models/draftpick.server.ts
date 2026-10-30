import type { DraftPick, League } from '@prisma/client';
import { prisma } from '~/db.server';

export type { DraftPick } from '@prisma/client';

export type DraftPickCreate = Omit<DraftPick, 'id'>;

export async function createDraftPick(draftPick: DraftPickCreate) {
  return prisma.draftPick.create({
    data: draftPick,
  });
}

export async function deleteDraftPicks(ids: DraftPick['id'][]) {
  return prisma.draftPick.deleteMany({
    where: {
      id: {
        in: ids,
      },
    },
  });
}

export async function getDraftPicks(id: League['id']) {
  return prisma.league.findUnique({
    where: {
      id,
    },
    select: {
      teams: {
        select: {
          DraftPicks: true,
        },
      },
    },
  });
}

/** A league's draft for its board: every pick, the player and the team. */
export async function getDraftBoardPicks(leagueId: League['id']) {
  return prisma.draftPick.findMany({
    where: { team: { leagueId } },
    orderBy: { pickNumber: 'asc' },
    include: { Player: true, team: { include: { user: true } } },
  });
}

export async function countDraftPicksByLeague(leagueId: League['id']) {
  return prisma.draftPick.count({ where: { team: { leagueId } } });
}

export async function getAverageDraftPositionByYear(year: League['year']) {
  return prisma.draftPick.groupBy({
    by: ['playerId'],
    where: {
      team: {
        league: {
          year,
        },
      },
    },
    _avg: {
      pickNumber: true,
    },
    _min: {
      pickNumber: true,
    },
    _max: {
      pickNumber: true,
    },
    _count: {
      pickNumber: true,
    },
    orderBy: [
      {
        _avg: {
          pickNumber: 'asc',
        },
      },
      {
        _min: {
          pickNumber: 'asc',
        },
      },
    ],
  });
}
