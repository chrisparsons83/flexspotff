import type { NFLGame, PoolGame } from '@prisma/client';

import { prisma } from '~/db.server';

export type { PoolGame } from '@prisma/client';

export type Bet = { teamId: string; amount: number };

export type PoolGameCreate = Omit<PoolGame, 'id'>;

type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;
export type PoolGameByYearAndWeekElement = ArrElement<
  Awaited<ReturnType<typeof getPoolGamesByYearAndWeek>>
>;

export async function getPoolGamesByYearAndWeek(
  year: NFLGame['year'],
  week: NFLGame['week'],
) {
  return prisma.poolGame.findMany({
    where: {
      game: {
        year,
        week,
      },
    },
    include: {
      game: {
        include: {
          homeTeam: true,
          awayTeam: true,
        },
      },
    },
    orderBy: {
      game: {
        gameStartTime: 'asc',
      },
    },
  });
}

export async function upsertPoolGame(poolGame: PoolGameCreate) {
  return prisma.poolGame.upsert({
    where: {
      gameId: poolGame.gameId,
    },
    update: {
      ...poolGame,
    },
    create: {
      ...poolGame,
    },
  });
}
