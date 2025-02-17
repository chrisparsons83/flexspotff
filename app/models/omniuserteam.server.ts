import { prisma } from '~/db.server';

export type { OmniUserTeam } from '@prisma/client';

export async function getOmniUserTeamByUserIdAndSeason(
  seasonId: string,
  userId: string,
) {
  return prisma.omniUserTeam.findFirst({
    where: {
      seasonId,
      userId,
    },
  });
}
