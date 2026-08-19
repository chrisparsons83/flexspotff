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

export async function getSleeperUsersByOwnerIds(
  sleeperOwnerIDs: SleeperUser['sleeperOwnerID'][],
) {
  return prisma.sleeperUser.findMany({
    where: {
      sleeperOwnerID: { in: sleeperOwnerIDs },
    },
    select: {
      sleeperOwnerID: true,
      userId: true,
    },
  });
}

export async function getSleeperUserByOwnerId(
  sleeperOwnerID: SleeperUser['sleeperOwnerID'],
) {
  return prisma.sleeperUser.findUnique({
    where: {
      sleeperOwnerID,
    },
    include: {
      user: true,
    },
  });
}

/**
 * Points a Sleeper owner ID at a member and backfills every team that owner
 * already has. A league sync only assigns Team.userId from the mapping that
 * existed when it ran, so without the backfill a freshly matched owner stays
 * unattached everywhere until the next sync.
 */
export async function matchSleeperOwnerToUser({
  sleeperOwnerID,
  userId,
}: SleeperUser) {
  const [sleeperUser, { count }] = await prisma.$transaction([
    prisma.sleeperUser.upsert({
      where: {
        sleeperOwnerID,
      },
      update: {
        userId,
      },
      create: {
        sleeperOwnerID,
        userId,
      },
    }),
    prisma.team.updateMany({
      where: {
        sleeperOwnerId: sleeperOwnerID,
      },
      data: {
        userId,
      },
    }),
  ]);

  return { sleeperUser, teamsUpdated: count };
}
