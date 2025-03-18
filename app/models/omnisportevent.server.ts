import { prisma } from '~/db.server';

export async function getOmniSportEvents() {
  return prisma.omniSportEvent.findMany({
    orderBy: {
      name: 'asc',
    },
    include: {
      sport: true,
      omniSportEventPoints: {
        include: {
          player: true,
        },
      },
    },
  });
}
