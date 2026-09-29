import type { FSquaredEntry, Team } from '@prisma/client';
import { prisma } from '~/db.server';
import { fSquaredEntryPoints } from '~/models/profile/sideGameScoring';
import type { ArrElement } from '~/utils/types';

export type { FSquaredEntry } from '@prisma/client';

type FSquaredEntryCreateInput = Omit<
  FSquaredEntry,
  'id' | 'createdAt' | 'updatedAt'
>;

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
              discordUsername: true,
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

/** The years anyone entered F², newest first. */
export async function getFSquaredYears() {
  const years = await prisma.fSquaredEntry.groupBy({
    by: ['year'],
    orderBy: { year: 'desc' },
  });

  return years.map(({ year }) => year);
}

/**
 * A year's entries, ranked by their teams' combined points-for, with each
 * entry's teams in league order.
 */
export async function getStandingsForYear(year: FSquaredEntry['year']) {
  const results = (await getResultsForYear(year))
    .map(entry => {
      const totalPoints = fSquaredEntryPoints(entry.teams);
      return { ...entry, totalPoints };
    })
    .sort((a, b) => {
      const pointsDiff = b.totalPoints - a.totalPoints;
      if (pointsDiff !== 0) return pointsDiff;

      return a.user.discordName.localeCompare(b.user.discordName);
    });

  // Sort the teams in each entry by league and name
  for (const entry of results) {
    entry.teams.sort((a, b) => {
      if (a.league.tier !== b.league.tier) {
        return a.league.tier - b.league.tier;
      }

      return a.league.name.localeCompare(b.league.name);
    });
  }

  return results;
}
