import { prisma } from '~/db.server';

export type { OmniDraftPick } from '@prisma/client';

export function getPlayersAndAssociatedPick(seasonId: string) {
  return prisma.omniPlayer.findMany({
    where: {
      seasonId,
      isActive: true,
    },
    include: {
      draftPick: {
        include: {
          team: {
            include: {
              user: true,
            },
          },
        },
      },
      sport: true,
    },
  });
}
