import type { Cup, CupGame } from "@prisma/client";

import { prisma } from "~/db.server";

export type { CupGame } from "@prisma/client";

type CupGameCreate = Omit<CupGame, "id">;

export async function createCupGame(data: CupGameCreate) {
  return prisma.cupGame.create({
    data,
  });
}

export async function getCupGamesByCup(cupId: Cup["id"]) {
  return prisma.cupGame.findMany({
    where: {
      cupId,
    },
    include: {
      bottomTeam: {
        include: {
          team: {
            include: {
              user: true,
            },
          },
        },
      },
      topTeam: {
        include: {
          team: {
            include: {
              user: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        roundSort: "desc",
      },
      {
        insideRoundSort: "asc",
      },
    ],
  });
}

export async function updateCupGame(id: CupGame["id"], data: Partial<CupGame>) {
  return prisma.cupGame.update({
    where: {
      id,
    },
    data,
  });
}
