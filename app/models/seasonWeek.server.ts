import type { Season } from './season.server';
import type { SeasonWeek } from '@prisma/client';
import { prisma } from '~/db.server';

export type { SeasonWeek } from '@prisma/client';

export type CreateSeasonWeek = Omit<
  SeasonWeek,
  'id' | 'createdAt' | 'updatedAt'
>;

export const createSeasonWeek = async (seasonWeek: CreateSeasonWeek) => {
  return prisma.seasonWeek.create({
    data: seasonWeek,
  });
};

export const getCurrentWeek = async () => {
  return prisma.seasonWeek.findFirst({
    where: {
      weekStart: {
        lte: new Date(),
      },
      weekEnd: {
        gte: new Date(),
      },
    },
  });
};

export const getSeasonWeeksBySeason = async (season: Season) => {
  return prisma.seasonWeek.findMany({
    where: {
      seasonId: season.id,
    },
  });
};
