import type {
  OmniDraftPick,
  OmniPlayer,
  OmniSport,
  OmniUserTeam,
  User,
} from '@prisma/client';
import { prisma } from '~/db.server';

export type DraftBoardColumnProps = {
  omniTeam: OmniUserTeam & {
    user: User | null;
    draftPicks: (OmniDraftPick & {
      player:
        | (OmniPlayer & {
            sport: OmniSport;
          })
        | null;
    })[];
  };
};

export async function getCurrentOmniSeason() {
  return prisma.omniSeason.findFirst({
    where: {
      isCurrent: true,
    },
  });
}

export async function getOmniSeason(year: number) {
  return prisma.omniSeason.findFirst({
    where: {
      year,
    },
    include: {
      omniTeams: {
        include: {
          draftPicks: {
            include: {
              player: {
                include: {
                  sport: true,
                },
              },
            },
          },
          user: true,
        },
      },
    },
  });
}

/**
 * Helper Functions
 */
export function getOmniStandings(
  season: NonNullable<Awaited<ReturnType<typeof getOmniSeason>>>,
) {
  const rankedPoints = season.omniTeams
    .map(omniTeam =>
      omniTeam.draftPicks.reduce(
        (acc, pick) => acc + (pick.player?.pointsScored || 0),
        0,
      ),
    )
    .sort((a, b) => Number(a) - Number(b))
    .reverse();

  return season.omniTeams
    .map(omniTeam => {
      const totalPoints = omniTeam.draftPicks.reduce(
        (acc, pick) => acc + (pick.player?.pointsScored || 0),
        0,
      );

      const remainingPlayers = omniTeam.draftPicks.filter(
        pick => !pick.player?.isComplete,
      ).length;

      return {
        owner: omniTeam.user?.discordName || '',
        totalPoints,
        rank: rankedPoints.findIndex(rank => rank === totalPoints) + 1,
        remainingPlayers,
      };
    })
    .sort((a, b) => {
      if (a.totalPoints < b.totalPoints) {
        return 1;
      } else if (a.totalPoints > b.totalPoints) {
        return -1;
      } else {
        return a.owner.localeCompare(b.owner);
      }
    });
}
