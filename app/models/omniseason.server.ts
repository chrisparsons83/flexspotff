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
