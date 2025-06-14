import type { OmniPlayer } from '@prisma/client';
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

export function createOmniPlayer({
  displayName,
  sportId,
  seasonId,
  relativeSort,
}: Pick<OmniPlayer, 'displayName' | 'sportId' | 'seasonId' | 'relativeSort'>) {
  return prisma.omniPlayer.create({
    data: {
      displayName,
      sportId,
      seasonId,
      relativeSort,
    },
  });
}

export function updateOmniPlayer(player: Partial<OmniPlayer>) {
  return prisma.omniPlayer.update({
    where: {
      id: player.id,
    },
    data: {
      ...player,
    },
  });
}
