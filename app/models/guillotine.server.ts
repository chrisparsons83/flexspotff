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

const teamMember = {
  select: {
    id: true,
    discordName: true,
    discordUsername: true,
  },
} as const;

/** Every season with each league's podium, for the public history page. */
export async function getGuillotineHistory() {
  return prisma.guillotineSeason.findMany({
    orderBy: { year: 'desc' },
    include: {
      leagues: {
        orderBy: { name: 'asc' },
        include: {
          teams: {
            select: {
              rosterId: true,
              finish: true,
              choppedWeek: true,
              sleeperDisplayName: true,
              user: teamMember,
            },
          },
        },
      },
    },
  });
}

/** The newest season's leagues, for the Games sidebar. */
export async function getLatestGuillotineLeagues() {
  const season = await prisma.guillotineSeason.findFirst({
    orderBy: { year: 'desc' },
    include: {
      leagues: { orderBy: { name: 'asc' }, select: { id: true, name: true } },
    },
  });
  return season ? { year: season.year, leagues: season.leagues } : null;
}

/** Every league, for the league switcher. */
export async function getAllGuillotineLeagues() {
  return prisma.guillotineLeague.findMany({
    select: { id: true, name: true, season: { select: { year: true } } },
    orderBy: [{ season: { year: 'desc' } }, { name: 'asc' }],
  });
}

/** A league with every team, its member and every week it played. */
export async function getGuillotineLeagueForPage(id: string) {
  return prisma.guillotineLeague.findUnique({
    where: { id },
    include: {
      season: { select: { year: true } },
      teams: {
        include: {
          user: teamMember,
          weekScores: { orderBy: { week: 'asc' } },
        },
      },
    },
  });
}

export async function getGuillotineTransactions(guillotineLeagueId: string) {
  return prisma.guillotineTransaction.findMany({
    where: { guillotineLeagueId },
    orderBy: { processedAt: 'asc' },
  });
}

export async function getGuillotineDraftPicks(guillotineLeagueId: string) {
  return prisma.guillotineDraftPick.findMany({
    where: { guillotineLeagueId },
    orderBy: { pickNo: 'asc' },
  });
}
