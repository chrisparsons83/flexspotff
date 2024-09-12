import type { LocksWeek } from '@prisma/client';
import { prisma } from '~/db.server';

export type { LocksWeek } from '@prisma/client';

type LocksWeekCreateInput = Omit<LocksWeek, 'id' | 'createdAt' | 'updatedAt'>;

export async function createLocksWeek(locksWeek: LocksWeekCreateInput) {
  return prisma.locksWeek.create({
    data: locksWeek,
  });
}

export async function getLocksWeek(id: LocksWeek['id']) {
  return prisma.locksWeek.findUnique({
    where: {
      id,
    },
  });
}

export async function getLocksWeekByYearAndWeek(
  year: LocksWeek['year'],
  weekNumber: LocksWeek['weekNumber'],
) {
  return prisma.locksWeek.findFirst({
    where: {
      year,
      weekNumber,
    },
    orderBy: [
      {
        weekNumber: 'desc',
      },
    ],
  });
}

export async function getLocksWeeksByYear(year: LocksWeek['year']) {
  return prisma.locksWeek.findMany({
    where: {
      year,
    },
    orderBy: {
      weekNumber: 'desc',
    },
  });
}

export async function getNewestLocksWeekForYear(year: LocksWeek['year']) {
  return prisma.locksWeek.findFirst({
    where: {
      year,
    },
    orderBy: {
      weekNumber: 'desc',
    },
  });
}

export async function updateLocksWeek(locksWeek: LocksWeek) {
  return prisma.locksWeek.update({
    where: {
      id: locksWeek.id,
    },
    data: locksWeek,
  });
}
