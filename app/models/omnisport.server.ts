import { prisma } from '~/db.server';

export async function getCurrentOmniSeason() {
  return prisma.omniSeason.findFirst({
    where: {
      isCurrent: true,
    },
  });
}

export async function getSportById(id: string) {
  return prisma.omniSport.findFirst({
    where: {
      id,
    },
  });
}

export async function getActiveSports() {
  return prisma.omniSport.findMany({
    orderBy: {
      name: 'asc',
    },
  });
}
