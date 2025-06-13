import type {
  DFSSurvivorUserYear,
  DFSSurvivorUserWeek,
  DFSSurvivorUserEntry,
} from '@prisma/client';
import { prisma } from '~/db.server';

export type { DFSSurvivorUserYear } from '@prisma/client';

export type DFSSurvivorUserYearWithWeeks = DFSSurvivorUserYear & {
  weeks: (DFSSurvivorUserWeek & {
    entries: DFSSurvivorUserEntry[];
  })[];
};

export async function getDfsSurvivorYearByUserAndYear(
  userId: string,
  year: number,
): Promise<DFSSurvivorUserYearWithWeeks | null> {
  return prisma.dFSSurvivorUserYear.findFirst({
    where: {
      userId,
      year,
    },
    include: {
      weeks: {
        include: {
          entries: true,
        },
      },
    },
  });
}

export async function createDfsSurvivorYear(
  userId: string,
  year: number,
): Promise<DFSSurvivorUserYearWithWeeks> {
  const dfsSurvivorYear = await prisma.dFSSurvivorUserYear.create({
    data: {
      userId,
      year,
      points: 0,
    },
  });

  // Create weeks 1-17
  for (let week = 1; week <= 17; week++) {
    await prisma.dFSSurvivorUserWeek.create({
      data: {
        userId,
        year,
        week,
        isScored: false,
      },
    });
  }

  // Fetch the year with all created weeks and entries
  const yearWithWeeks = await prisma.dFSSurvivorUserYear.findUnique({
    where: {
      id: dfsSurvivorYear.id,
    },
    include: {
      weeks: {
        include: {
          entries: true,
        },
      },
    },
  });

  if (!yearWithWeeks) {
    throw new Error('Failed to fetch created DFS Survivor year with weeks');
  }

  return yearWithWeeks;
}
