import type { Registration, User } from '@prisma/client';
import { prisma } from '~/db.server';

export type { Registration } from '@prisma/client';

export async function createRegistration(
  userId: User['id'],
  year: Registration['year'],
) {
  return prisma.registration.create({
    data: {
      year,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });
}

/**
 * Atomically register a user for a season and save their draft-time
 * preferences. Used for the combined "register + pick at least 3 times" flow.
 */
export async function registerWithDraftPreferences(
  userId: User['id'],
  year: Registration['year'],
  seasonId: string,
  draftSlotIds: string[],
) {
  const [registration] = await prisma.$transaction([
    prisma.registration.create({
      data: {
        year,
        user: {
          connect: {
            id: userId,
          },
        },
      },
    }),
    prisma.draftSlotPreference.deleteMany({
      where: {
        userId,
        seasonId,
      },
    }),
    prisma.draftSlotPreference.createMany({
      data: draftSlotIds.map(draftSlotId => ({
        userId,
        draftSlotId,
        seasonId,
      })),
    }),
  ]);

  return registration;
}

export async function getRegistrationByUserAndYear(
  userId: User['id'],
  year: Registration['year'],
) {
  return prisma.registration.findFirst({
    where: { year, userId },
  });
}

export async function getRegistrationCountByYear(year: Registration['year']) {
  return prisma.registration.count({
    where: { year },
  });
}

export async function getRegistrationsByYear(year: Registration['year']) {
  return prisma.registration.findMany({
    where: { year },
    include: {
      user: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}
