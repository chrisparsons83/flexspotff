import { prisma } from '~/db.server';

export async function getCurrentOmniSeason() {
  return prisma.omniSeason.findFirst({
    where: {
      isCurrent: true,
    },
  });
}

export async function getOmniSeason(year: number) {
  return prisma.omniSeason.findFirst({
    where: {
      year,
    },
    include: {
      omniTeams: {
        include: {
          draftPicks: {
            include: {
              player: true,
            },
          },
          user: true,
        },
      },
    },
  });
}
