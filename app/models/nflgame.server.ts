import type { NFLGame } from '@prisma/client';

import { prisma } from '~/db.server';

export type { NFLGame } from '@prisma/client';

export type GameCreate = Omit<NFLGame, 'id'>;

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
