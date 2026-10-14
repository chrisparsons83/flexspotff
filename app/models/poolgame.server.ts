import type { NFLGame, PoolGame, PoolWeek } from '@prisma/client';
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

/**
 * Deletes pool games along with every pick placed on them. A pick on a game
 * that is no longer in the pool should neither win nor lose anyone points, so
 * the picks go rather than being scored.
 */
export async function deletePoolGamesWithPicks(poolGameIds: PoolGame['id'][]) {
  if (poolGameIds.length === 0) return;

  await prisma.$transaction([
    prisma.poolGamePick.deleteMany({
      where: { poolGameId: { in: poolGameIds } },
    }),
    prisma.poolGame.deleteMany({
      where: { id: { in: poolGameIds } },
    }),
  ]);
}

/**
 * Pool games for a year whose NFL game is no longer in the week of the pool
 * week it was added to. That happens when Sleeper lists a game in one week and
 * later moves it: the schedule sync updates the game's week, but the pool game
 * stays linked to the old pool week, so its picks keep showing (and counting)
 * there.
 */
export async function getPoolGamesOutsideTheirWeek(year: PoolWeek['year']) {
  const poolGames = await prisma.poolGame.findMany({
    where: { poolWeek: { year } },
    include: {
      poolWeek: true,
      game: { select: { year: true, week: true } },
    },
  });

  return poolGames.filter(
    poolGame =>
      poolGame.poolWeek &&
      (poolGame.game.year !== poolGame.poolWeek.year ||
        poolGame.game.week !== poolGame.poolWeek.weekNumber),
  );
}

export async function getPoolGamesByNflGameIds(gameIds: NFLGame['id'][]) {
  if (gameIds.length === 0) return [];

  return prisma.poolGame.findMany({
    where: { gameId: { in: gameIds } },
  });
}
