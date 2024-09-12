import type { LocksGame, NFLGame } from '@prisma/client';
import { prisma } from '~/db.server';

export type { LocksGame } from '@prisma/client';

export type TeamPick = { teamId: string; isActive: number };

export type LocksGameCreate = Omit<LocksGame, 'id'>;

type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;
export type LocksGameByYearAndWeekElement = ArrElement<
  Awaited<ReturnType<typeof getLocksGamesByYearAndWeek>>
>;

export async function getLocksGamesByYearAndWeek(
  year: NFLGame['year'],
  week: NFLGame['week'],
) {
  return prisma.locksGame.findMany({
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

export async function upsertLocksGame(locksGame: LocksGameCreate) {
  return prisma.locksGame.upsert({
    where: {
      gameId: locksGame.gameId,
    },
    update: {
      ...locksGame,
    },
    create: {
      ...locksGame,
    },
  });
}
