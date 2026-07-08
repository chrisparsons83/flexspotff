import type { D12League } from '@prisma/client';
import { prisma } from '~/db.server';

export type { D12League } from '@prisma/client';

export async function createD12League(data: {
  name: string;
  sleeperLeagueId: string;
  d12SeasonId: string;
}) {
  const existing = await prisma.d12League.findUnique({
    where: { sleeperLeagueId: data.sleeperLeagueId },
  });
  if (existing)
    throw new Error(
      `A league with Sleeper ID ${data.sleeperLeagueId} already exists`,
    );
  return prisma.d12League.create({ data });
}

export async function getD12LeagueById(id: string) {
  return prisma.d12League.findUnique({ where: { id } });
}

export async function getD12LeaguesBySeasonId(d12SeasonId: string) {
  return prisma.d12League.findMany({
    where: { d12SeasonId },
    orderBy: { sleeperLeagueId: 'asc' },
  });
}

export async function deleteD12League(id: D12League['id']) {
  return prisma.d12League.delete({ where: { id } });
}
