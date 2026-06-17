import { prisma } from '~/db.server';

export type { D12Season } from '@prisma/client';

export async function createD12Season(year: number) {
  const existing = await prisma.d12Season.findUnique({ where: { year } });
  if (existing) throw new Error(`A D12 season for ${year} already exists`);
  return prisma.d12Season.create({
    data: { year },
  });
}

export async function getD12SeasonById(id: string) {
  return prisma.d12Season.findUnique({
    where: { id },
    include: { leagues: { orderBy: { sleeperLeagueId: 'asc' } } },
  });
}

export async function getD12SeasonByYear(year: number) {
  return prisma.d12Season.findUnique({
    where: { year },
    include: { leagues: { orderBy: { sleeperLeagueId: 'asc' } } },
  });
}

export async function getD12SeasonByYearWithScores(year: number) {
  return prisma.d12Season.findUnique({
    where: { year },
    include: {
      leagues: {
        include: {
          weekScores: true,
        },
      },
    },
  });
}

export async function getAllD12Seasons() {
  return prisma.d12Season.findMany({
    orderBy: { year: 'desc' },
    include: { leagues: { orderBy: { sleeperLeagueId: 'asc' } } },
  });
}

export async function getAllD12SeasonYears() {
  const seasons = await prisma.d12Season.findMany({
    orderBy: { year: 'desc' },
    select: { year: true },
  });
  return seasons.map(s => s.year);
}

export async function deleteD12Season(id: string) {
  return prisma.d12Season.delete({ where: { id } });
}

export async function getLatestD12Season() {
  return prisma.d12Season.findFirst({
    orderBy: { year: 'desc' },
  });
}
