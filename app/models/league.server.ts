import type { League } from '@prisma/client';
import { prisma } from '~/db.server';

export type { League } from '@prisma/client';

type LeagueCreateInput = Omit<League, 'id' | 'createdAt' | 'updatedAt'>;

type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;
export type GetLeaguesByYearElement = ArrElement<
  Awaited<ReturnType<typeof getLeaguesByYear>>
>;

export async function createLeague(league: LeagueCreateInput) {
  return prisma.league.create({
    data: league,
  });
}

export async function getLeague(id: League['id']) {
  return prisma.league.findUnique({
    where: {
      id,
    },
  });
}

export async function getLeagues() {
  return prisma.league.findMany({
    orderBy: [
      {
        year: 'desc',
      },
      {
        tier: 'asc',
      },
      {
        name: 'asc',
      },
    ],
    include: {
      teams: true,
    },
  });
}

export async function getLeaguesByYear(year: League['year']) {
  return prisma.league.findMany({
    where: {
      year,
    },
    orderBy: [
      {
        year: 'desc',
      },
      {
        tier: 'asc',
      },
      {
        name: 'asc',
      },
    ],
    include: {
      teams: {
        include: {
          user: true,
        },
        orderBy: [
          {
            wins: 'desc',
          },
          {
            ties: 'desc',
          },
          {
            pointsFor: 'desc',
          },
        ],
      },
    },
  });
}

export async function getLeagueCountsByYear() {
  return prisma.league.groupBy({
    by: ['year'],
    _count: { _all: true },
  });
}

export async function getLeagueCountForYear(year: League['year']) {
  return prisma.league.count({
    where: {
      year,
    },
  });
}

type LeagueUpdateInput = Pick<League, 'id'> &
  Partial<Omit<League, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Updates the scalar columns of a league. Every field is optional, so a caller
 * only names what it owns and leaves the rest of the row alone.
 *
 * The fields are pulled out by hand rather than handed to Prisma wholesale:
 * callers pass whole league rows, and a row read with `include: { teams }`
 * carries a teams array that Prisma rejects as an update payload.
 */
export async function updateLeague({
  id,
  year,
  name,
  sleeperLeagueId,
  sleeperDraftId,
  draftDateTime,
  tier,
  isActive,
  isDrafted,
}: LeagueUpdateInput) {
  return prisma.league.update({
    where: {
      id,
    },
    data: {
      year,
      name,
      sleeperLeagueId,
      sleeperDraftId,
      draftDateTime,
      tier,
      isActive,
      isDrafted,
    },
  });
}
