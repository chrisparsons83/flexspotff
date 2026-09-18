import type { NFLGame } from '@prisma/client';
import { prisma } from '~/db.server';

export type { NFLGame } from '@prisma/client';

export type GameCreate = Omit<NFLGame, 'id'>;

enum NFLGameStatus {
  Complete = 'complete',
  InGame = 'in_game',
  PreGame = 'pre_game',
}

export async function getNflGamesBySeason(year: NFLGame['year']) {
  return prisma.nFLGame.findMany({
    where: {
      year,
    },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
    orderBy: {
      gameStartTime: 'asc',
    },
  });
}

export async function getNflGameById(id: NFLGame['id']) {
  return prisma.nFLGame.findUnique({
    where: {
      id,
    },
  });
}

export async function getWeekNflGames(
  year: NFLGame['year'],
  week: NFLGame['week'],
) {
  return prisma.nFLGame.findMany({
    where: {
      year,
      week,
    },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
    orderBy: {
      gameStartTime: 'asc',
    },
  });
}

/**
 * The week the season is currently on: the earliest week that still has a game
 * left to kick off. Once every game of the year has started this returns the
 * last week of the season, so the entry page always lands somewhere real.
 *
 * There is no `Season.currentWeek` column and Sleeper's NFL state is only
 * fetched by sync jobs, so this derives it from the schedule we already store.
 */
export async function getCurrentNflWeek(
  year: NFLGame['year'],
  now: Date,
): Promise<number | null> {
  const upcoming = await prisma.nFLGame.findFirst({
    where: { year, gameStartTime: { gt: now } },
    orderBy: [{ week: 'asc' }, { gameStartTime: 'asc' }],
    select: { week: true },
  });
  if (upcoming) return upcoming.week;

  const last = await prisma.nFLGame.findFirst({
    where: { year },
    orderBy: { week: 'desc' },
    select: { week: true },
  });
  return last?.week ?? null;
}

export async function getActiveNflGames() {
  return prisma.nFLGame.aggregate({
    where: {
      status: NFLGameStatus.InGame,
    },
    _count: {
      id: true,
    },
  });
}

export async function upsertNflGame(game: GameCreate) {
  return prisma.nFLGame.upsert({
    where: {
      sleeperGameId: game.sleeperGameId,
    },
    update: {
      ...game,
    },
    create: {
      ...game,
    },
  });
}
