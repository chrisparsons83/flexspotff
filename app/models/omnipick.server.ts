import { prisma } from '~/db.server';

export type { OmniDraftPick } from '@prisma/client';

export function getPendingPicksBySeason(seasonId: string) {
  return prisma.omniDraftPick.findMany({
    where: {
      pickStartTime: {
        lte: new Date(),
      },
      playerId: null,
    },
    include: {
      team: {
        include: {
          user: true,
        },
      },
    },
  });
}

export function getPickByPickNumber(pickNumber: number) {
  return prisma.omniDraftPick.findFirst({
    where: {
      pickNumber,
    },
    include: {
      team: {
        include: {
          user: true,
        },
      },
    },
  });
}

export function getLatestPickMade() {
  return prisma.omniDraftPick.findFirst({
    where: {
      pickMadeTime: {
        not: null,
      },
    },
    orderBy: {
      pickNumber: 'desc',
    },
  });
}

export function getNextOmniPickForTeam(teamId: string) {
  const currentTime = new Date();

  return prisma.omniDraftPick.findFirst({
    where: {
      teamId,
      pickStartTime: {
        lte: currentTime,
      },
      playerId: null,
    },
    orderBy: {
      pickNumber: 'asc',
    },
  });
}

export function updateDraftPick(pickId: string, playerId: string) {
  return prisma.omniDraftPick.update({
    where: {
      id: pickId,
    },
    data: {
      playerId,
      pickMadeTime: new Date(),
    },
  });
}

export function updateDraftPickTimeByPickNumber(
  pickNumber: number,
  pickStartTime: Date,
) {
  return prisma.omniDraftPick.updateMany({
    where: {
      pickNumber,
    },
    data: {
      pickStartTime,
    },
  });
}
