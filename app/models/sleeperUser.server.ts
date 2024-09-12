import type { SleeperUser } from '@prisma/client';
import { prisma } from '~/db.server';

export type { SleeperUser } from '@prisma/client';

export async function createOrUpdateSleeperUser(sleeperUser: SleeperUser) {
  return prisma.sleeperUser.upsert({
    where: {
      sleeperOwnerID: sleeperUser.sleeperOwnerID,
    },
    update: {
      userId: sleeperUser.userId,
    },
    create: sleeperUser,
  });
}

export async function deleteSleeperUser(
  sleeperOwnerID: SleeperUser['sleeperOwnerID'],
) {
  return prisma.sleeperUser.delete({
    where: {
      sleeperOwnerID: sleeperOwnerID,
    },
  });
}

export async function getSleeperOwnerIdsByUserId(id: SleeperUser['userId']) {
  return prisma.sleeperUser.findMany({
    where: {
      userId: id,
    },
  });
}
