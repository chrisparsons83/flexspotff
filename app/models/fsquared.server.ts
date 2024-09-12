import type { FSquaredEntry, Team } from '@prisma/client';

import { prisma } from '~/db.server';

export type { FSquaredEntry } from '@prisma/client';

type FSquaredEntryCreateInput = Omit<
  FSquaredEntry,
  'id' | 'createdAt' | 'updatedAt'
>;

// Doing this because Prisma hates me actually aggregating a sum based on connected fields.
type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;
export type currentResultsBase = ArrElement<
  Awaited<ReturnType<typeof getResultsForYear>>
> & {
  totalPoints: number;
};

export async function createEntry(entry: FSquaredEntryCreateInput) {
  return prisma.fSquaredEntry.create({
    data: entry,
  });
}

export async function getEntry(id: FSquaredEntry['id']) {
  return prisma.fSquaredEntry.findUnique({
    where: {
      id,
    },
  });
}

export async function getEntryByUserAndYear(
  userId: FSquaredEntry['userId'],
  year: FSquaredEntry['year'],
) {
  return prisma.fSquaredEntry.findFirst({
    where: {
      userId,
      year,
    },
    include: {
      teams: {
        include: {
          league: true,
        },
      },
    },
  });
}

export async function getResultsForYear(year: FSquaredEntry['year']) {
  return prisma.fSquaredEntry.findMany({
    where: {
      year,
    },
    select: {
      id: true,
      teams: {
        select: {
          id: true,
          league: {
            select: {
              name: true,
              tier: true,
              draftDateTime: true,
            },
          },
          pointsFor: true,
          user: {
            select: {
              discordName: true,
            },
          },
        },
      },
      user: true,
    },
  });
}

export async function updateEntry(
  id: FSquaredEntry['id'],
  newEntries: Team['id'][],
  oldEntries: Team['id'][],
) {
  return prisma.fSquaredEntry.update({
    where: {
      id,
    },
    data: {
      teams: {
        disconnect: oldEntries.map(entry => ({ id: entry })),
        connect: newEntries.map(entry => ({ id: entry })),
      },
    },
  });
}
