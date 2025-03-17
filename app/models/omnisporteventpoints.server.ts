import type { OmniSportEventPoints } from '@prisma/client';
import { prisma } from '~/db.server';

export async function createOmniSportEventPoints(
  data: Omit<OmniSportEventPoints, 'id' | 'createdAt' | 'updatedAt'>,
) {
  return prisma.omniSportEventPoints.create({
    data,
  });
}

export async function updateOmniSportEventPoints(
  data: Partial<OmniSportEventPoints>,
) {
  return prisma.omniSportEventPoints.update({
    where: {
      id: data.id,
    },
    data,
  });
}
