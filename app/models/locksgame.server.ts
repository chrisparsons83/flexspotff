import type { LocksGame, LocksWeek, NFLGame } from '@prisma/client';
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

/**
 * Deletes locks games along with every pick placed on them, so a pick on a
 * game that is no longer in the challenge is never scored.
 */
export async function deleteLocksGamesWithPicks(
  locksGameIds: LocksGame['id'][],
) {
  if (locksGameIds.length === 0) return;

  await prisma.$transaction([
    prisma.locksGamePick.deleteMany({
      where: { locksGameId: { in: locksGameIds } },
    }),
    prisma.locksGame.deleteMany({
      where: { id: { in: locksGameIds } },
    }),
  ]);
}

/**
 * Locks games for a year whose NFL game is no longer in the week of the locks
 * week it was published to, because Sleeper later moved the game.
 */
export async function getLocksGamesOutsideTheirWeek(year: LocksWeek['year']) {
  const locksGames = await prisma.locksGame.findMany({
    // A scored week's results stand, whatever Sleeper says later.
    where: { locksWeek: { year, isWeekScored: false } },
    include: {
      locksWeek: true,
      game: { select: { year: true, week: true } },
    },
  });

  return locksGames.filter(
    locksGame =>
      locksGame.locksWeek &&
      (locksGame.game.year !== locksGame.locksWeek.year ||
        locksGame.game.week !== locksGame.locksWeek.weekNumber),
  );
}

export async function getLocksGamesByNflGameIds(gameIds: NFLGame['id'][]) {
  if (gameIds.length === 0) return [];

  return prisma.locksGame.findMany({
    where: {
      gameId: { in: gameIds },
      // A scored week's results stand, whatever Sleeper says later.
      OR: [{ locksWeekId: null }, { locksWeek: { isWeekScored: false } }],
    },
  });
}
