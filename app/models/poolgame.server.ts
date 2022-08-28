import type { NFLGame, PoolGame } from "@prisma/client";

import { prisma } from "~/db.server";

export type { PoolGame } from "@prisma/client";

export type PoolGameCreate = Omit<PoolGame, "id">;

export async function getPoolGamesByYearAndWeek(
  year: NFLGame["year"],
  week: NFLGame["week"]
) {
  return prisma.poolGame.findMany({
    where: {
      game: {
        year,
        week,
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
