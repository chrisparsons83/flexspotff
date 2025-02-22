import { prisma } from '~/db.server';

export type { OmniUserTeam } from '@prisma/client';

export async function getOmniUserTeamsBySeason(seasonId: string) {
  return prisma.omniUserTeam.findMany({
    where: {
      seasonId,
    },
    include: {
      draftPicks: {
        include: {
          player: {
            include: {
              sport: true,
            },
          },
        },
      },
    },
  });
}

export async function getOmniUserTeamByUserIdAndSeason(
  seasonId: string,
  userId: string,
) {
  return prisma.omniUserTeam.findFirst({
    where: {
      seasonId,
      userId,
    },
    include: {
      draftPicks: {
        include: {
          player: {
            include: {
              sport: true,
            },
          },
        },
      },
    },
  });
}
