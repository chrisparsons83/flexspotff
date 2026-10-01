import { prisma } from '~/db.server';

export type {
  BestBallLeague,
  BestBallSeason,
  BestBallTeam,
} from '@prisma/client';

/** Every league, newest first, for the admin list. */
export async function getBestBallLeaguesForAdmin() {
  return prisma.bestBallLeague.findMany({
    orderBy: { season: { year: 'desc' } },
    include: {
      season: { select: { year: true } },
      teams: { select: { userId: true } },
    },
  });
}

export async function getBestBallLeagueById(id: string) {
  return prisma.bestBallLeague.findUnique({ where: { id } });
}

/** A league with its teams and members, for the admin page. */
export async function getBestBallLeagueWithTeams(id: string) {
  return prisma.bestBallLeague.findUnique({
    where: { id },
    include: {
      season: true,
      teams: {
        orderBy: { pointsFor: 'desc' },
        include: {
          user: { select: { id: true, discordName: true } },
        },
      },
    },
  });
}

/**
 * Sets, or clears with null, the member for a roster Sleeper has no owner
 * for. Only ownerless rosters: one with an owner follows that Sleeper
 * account's match instead.
 *
 * @returns how many teams changed.
 */
export async function assignOwnerlessBestBallTeam({
  bestBallLeagueId,
  teamId,
  userId,
}: {
  bestBallLeagueId: string;
  teamId: string;
  userId: string | null;
}) {
  const { count } = await prisma.bestBallTeam.updateMany({
    where: { id: teamId, bestBallLeagueId, sleeperOwnerId: null },
    data: { userId },
  });
  return count;
}

/** Deletes a league and its season with it, since a season holds one league. */
export async function deleteBestBallLeague(id: string) {
  const league = await prisma.bestBallLeague.findUnique({ where: { id } });
  if (!league) return null;
  await prisma.bestBallSeason.delete({
    where: { id: league.bestBallSeasonId },
  });
  return league;
}

const teamMember = {
  select: {
    id: true,
    discordName: true,
    discordUsername: true,
  },
} as const;

/** Every season's league with each team's total, for the history page. */
export async function getBestBallHistory() {
  return prisma.bestBallLeague.findMany({
    orderBy: { season: { year: 'desc' } },
    include: {
      season: { select: { year: true } },
      teams: {
        orderBy: { pointsFor: 'desc' },
        select: {
          rosterId: true,
          pointsFor: true,
          finish: true,
          sleeperDisplayName: true,
          user: teamMember,
        },
      },
    },
  });
}

/** The newest league, for the Games sidebar. */
export async function getLatestBestBallLeague() {
  return prisma.bestBallLeague.findFirst({
    orderBy: { season: { year: 'desc' } },
    select: { id: true, name: true, season: { select: { year: true } } },
  });
}

/** Every league, for the season switcher. */
export async function getAllBestBallLeagues() {
  return prisma.bestBallLeague.findMany({
    select: { id: true, name: true, season: { select: { year: true } } },
    orderBy: { season: { year: 'desc' } },
  });
}

/** The league's header details, for the layout every season page shares. */
export async function getBestBallLeagueByYear(year: number) {
  return prisma.bestBallLeague.findFirst({
    where: { season: { year } },
    include: { season: { select: { year: true } } },
  });
}

/** A season's league with every team, its member and every week it played. */
export async function getBestBallLeagueForPage(year: number) {
  return prisma.bestBallLeague.findFirst({
    where: { season: { year } },
    include: {
      season: { select: { year: true } },
      teams: {
        include: {
          user: teamMember,
          weekScores: {
            orderBy: { week: 'asc' },
            select: { week: true, points: true },
          },
        },
      },
    },
  });
}

export async function getBestBallDraftPicks(bestBallLeagueId: string) {
  return prisma.bestBallDraftPick.findMany({
    where: { bestBallLeagueId },
    orderBy: { pickNo: 'asc' },
  });
}
