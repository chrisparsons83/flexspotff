import type { League, Team } from '@prisma/client';
import { prisma } from '~/db.server';

export type { Team } from '@prisma/client';

type TeamCreateInput = Omit<Team, 'id' | 'createdAt' | 'updatedAt'>;
type TeamUpdateInput = Omit<Team, 'createdAt' | 'updatedAt'>;

export async function createTeam(team: TeamCreateInput) {
  return prisma.team.create({
    data: team,
  });
}

export async function getTeamBySleeperOwnerLeagueId(
  sleeperOwnerId: string,
  leagueId: string,
) {
  return prisma.team.findFirst({
    where: {
      sleeperOwnerId,
      leagueId,
    },
  });
}

export async function getTeams(leagueId: League['id']) {
  return prisma.team.findMany({
    where: {
      leagueId,
    },
  });
}

export async function getTeamsInSeason(year: League['year']) {
  return prisma.team.findMany({
    where: {
      league: {
        year,
      },
    },
    include: {
      league: {
        select: {
          name: true,
          tier: true,
          draftDateTime: true,
        },
      },
      user: {
        select: {
          discordName: true,
        },
      },
    },
    orderBy: [
      {
        league: {
          tier: 'asc',
        },
      },
      {
        league: {
          name: 'asc',
        },
      },
      {
        draftPosition: 'asc',
      },
    ],
  });
}

/**
 * Writes just the median columns.
 *
 * Separate from `updateTeam` because `TeamUpdateInput` is the whole row, and
 * the median backfill only knows these three fields - handing the rest back
 * from a stale read is how a backfill quietly reverts a sync.
 */
export async function updateTeamMedianRecord(team: {
  id: Team['id'];
  medianWins: number;
  medianLosses: number;
  medianTies: number;
}) {
  return prisma.team.update({
    where: { id: team.id },
    data: {
      medianWins: team.medianWins,
      medianLosses: team.medianLosses,
      medianTies: team.medianTies,
    },
  });
}

export async function updateTeam(team: TeamUpdateInput) {
  return prisma.team.update({
    where: {
      id: team.id,
    },
    data: team,
  });
}
