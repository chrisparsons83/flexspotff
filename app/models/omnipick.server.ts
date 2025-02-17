import { prisma } from '~/db.server';

export type { OmniDraftPick } from '@prisma/client';

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
