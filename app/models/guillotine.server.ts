import { prisma } from '~/db.server';

export type {
  GuillotineLeague,
  GuillotineSeason,
  GuillotineTeam,
} from '@prisma/client';

/** Every season and its leagues, newest first, for the admin list. */
export async function getGuillotineSeasonsForAdmin() {
  return prisma.guillotineSeason.findMany({
    orderBy: { year: 'desc' },
    include: {
      leagues: {
        orderBy: { name: 'asc' },
        include: {
          teams: { select: { userId: true } },
        },
      },
    },
  });
}

export async function getGuillotineLeagueById(id: string) {
  return prisma.guillotineLeague.findUnique({ where: { id } });
}

/** A league with its teams in finishing order, survivors first. */
export async function getGuillotineLeagueWithTeams(id: string) {
  return prisma.guillotineLeague.findUnique({
    where: { id },
    include: {
      season: true,
      teams: {
        include: {
          user: { select: { id: true, discordName: true } },
        },
      },
    },
  });
}

/**
 * Deletes a league, and its season too once nothing is left in it, so a
 * league added by mistake leaves no empty year behind.
 */
export async function deleteGuillotineLeague(id: string) {
  const league = await prisma.guillotineLeague.delete({ where: { id } });
  const remaining = await prisma.guillotineLeague.count({
    where: { guillotineSeasonId: league.guillotineSeasonId },
  });
  if (remaining === 0) {
    await prisma.guillotineSeason.delete({
      where: { id: league.guillotineSeasonId },
    });
  }
  return league;
}
