import type { Registration, User } from '@prisma/client';
import { Prisma } from '@prisma/client';
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

/**
 * The inverse of registerWithDraftPreferences: drop the registration and the
 * draft-time preferences that were saved alongside it. Nothing cascades from
 * Registration to DraftSlotPreference, so leaving the preferences behind would
 * keep the user showing up in season sorting after they've been unregistered.
 *
 * Returns null if the registration is already gone, which happens when two
 * admins remove the same person at once.
 */
export async function deleteRegistrationWithDraftPreferences(
  registrationId: Registration['id'],
  userId: User['id'],
  seasonId: string,
) {
  try {
    const [registration] = await prisma.$transaction([
      prisma.registration.delete({
        where: { id: registrationId },
      }),
      prisma.draftSlotPreference.deleteMany({
        where: {
          userId,
          seasonId,
        },
      }),
    ]);

    return registration;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return null;
    }

    throw error;
  }
}

export async function getRegistrationById(id: Registration['id']) {
  return prisma.registration.findUnique({
    where: { id },
    include: { user: true },
  });
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
