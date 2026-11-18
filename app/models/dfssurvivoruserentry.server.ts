import type { DFSSurvivorUserEntry } from '@prisma/client';
import { prisma } from '~/db.server';

export type { DFSSurvivorUserEntry } from '@prisma/client';

export async function updateDfsSurvivorEntryPoints(
  id: DFSSurvivorUserEntry['id'],
  points: DFSSurvivorUserEntry['points'],
) {
  return prisma.dFSSurvivorUserEntry.update({
    where: { id },
    data: { points },
  });
}
