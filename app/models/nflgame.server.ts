import type { NFLGame } from "@prisma/client";

import { prisma } from "~/db.server";

export type { NFLGame } from "@prisma/client";

export type GameCreate = Omit<NFLGame, "id">;

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
