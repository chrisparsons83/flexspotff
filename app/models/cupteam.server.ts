import type { Cup, CupTeam } from '@prisma/client';
import { prisma } from '~/db.server';

export type { CupTeam } from '@prisma/client';

type CupTeamCreate = Omit<CupTeam, 'id'>;

export async function createCupTeam(data: CupTeamCreate) {
  return prisma.cupTeam.create({
    data,
  });
}

export async function getCupTeamsByCup(cupId: Cup['id']) {
  return prisma.cupTeam.findMany({
    where: {
      cupId,
    },
  });
}
