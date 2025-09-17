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
