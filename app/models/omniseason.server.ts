import { prisma } from '~/db.server';

export async function getCurrentOmniSeason() {
  return prisma.omniSeason.findFirst({
    where: {
      isCurrent: true,
    },
  });
}
