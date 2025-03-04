import { prisma } from '~/db.server';
import type { DFSSurvivorUserWeek } from '@prisma/client';

export type { DFSSurvivorUserWeek } from '@prisma/client';

export async function getDfsSurvivorWeeksByYear(year: number) {
  return prisma.dFSSurvivorUserWeek.findMany({
    where: {
      year,
    },
    orderBy: {
      week: 'asc',
    },
  });
}

export async function getDfsSurvivorWeekByYearAndWeek(year: number, week: number) {
  return prisma.dFSSurvivorUserWeek.findFirst({
    where: {
      year,
      week,
    },
  });
}

export async function createDfsSurvivorWeek(userId: string, year: number, week: number) {
  return prisma.dFSSurvivorUserWeek.create({
    data: {
      userId,
      year,
      week,
      isScored: false,
    },
  });
} 