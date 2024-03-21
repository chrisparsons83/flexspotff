import type { LocksGamePick } from "~/models/locksgamepicks.server";
import type { LocksWeek } from "~/models/locksweek.server";
import type { User } from "~/models/user.server";

import { prisma } from "~/db.server";

import type { LocksGameByYearAndWeekElement } from "./locksgame.server";

export type { LocksGamePick } from "@prisma/client";

export type LocksGamePickCreate = Omit<
LocksGamePick,
  "id" | "createdAt" | "updatedAt" | "resultWonLoss"
>;

type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;
export type LocksGamePicksWonLoss = ArrElement<
  Awaited<ReturnType<typeof getLocksGamePicksWonLoss>>
>;

export async function createLocksGamePick(locksGamePick: LocksGamePickCreate) {
  return prisma.locksGamePick.create({
    data: locksGamePick,
  });
}

export async function createLocksGamePicks(locksGamePicks: LocksGamePickCreate[]) {
  return prisma.locksGamePick.createMany({
    data: locksGamePicks,
    skipDuplicates: true,
  });
}

export async function deleteLocksGamePicksForUserAndWeek(
  user: User,
  locksWeek: LocksWeek
) {
  return prisma.locksGamePick.deleteMany({
    where: {
      userId: user.id,
      locksGame: {
        locksWeekId: locksWeek.id,
      },
    },
  });
}

export async function getLocksGamesPicksByLocksWeek(locksWeek: LocksWeek) {
  return prisma.locksGamePick.findMany({
    where: {
      locksGame: {
        locksWeekId: locksWeek.id,
      },
    },
    include: {
      locksGame: {
        include: {
          game: true,
        },
      },
      teamBet: true,
    },
  });
}

export async function getLocksGamePicksByUserAndLocksWeek(
  user: User,
  locksWeek: LocksWeek
) {
  return prisma.locksGamePick.findMany({
    where: {
      userId: user.id,
      locksGame: {
        locksWeekId: locksWeek.id,
      },
    },
  });
}

export async function getLocksGamePicksByUserAndYear(
  user: User,
  year: LocksWeek["year"]
) {
  return prisma.locksGamePick.findMany({
    where: {
      userId: user.id,
      locksGame: {
        locksWeek: {
          year,
        },
      },
    },
    include: {
      locksGame: {
        include: {
          locksWeek: true,
        },
      },
    },
  });
}

export async function getLocksGamePicksWonLoss(year: LocksWeek["year"]) {
  return prisma.locksGamePick.groupBy({
    where: {
      locksGame: {
        locksWeek: {
          year,
        },
      },
      isScored: true,
    },
    by: ["userId"],
    _sum: {
      isWin: true,
      isLoss: true,
      isTie: true,
    },
  });
}

export async function getLocksGamePicksWonLossWeek(locksWeek: LocksWeek) {
  return prisma.locksGamePick.groupBy({
    where: {
      locksGame: {
        locksWeekId: locksWeek.id,
      },
      isScored: true,
    },
    by: ["userId"],
    _sum: {
      isWin: true,
      isLoss: true,
      isTie: true,
    },
  });
}

export async function updateLocksGamePicksWithResults(
  locksGame: LocksGameByYearAndWeekElement
) {
  if (
    locksGame.game.homeTeamScore > locksGame.game.awayTeamScore
  ) {
    return prisma.$transaction([
      prisma.$executeRaw`UPDATE "LocksGamePick" SET "isScored" = true, "isWin" = 1, "isTie" = 0, "isLoss" = 0 WHERE "locksGameId"=${locksGame.id} AND "teamBetId"=${locksGame.game.homeTeamId}`,
      prisma.$executeRaw`UPDATE "LocksGamePick" SET "isScored" = true, "isWin" = 0, "isTie" = 0, "isLoss" = 1 WHERE "locksGameId"=${locksGame.id} AND "teamBetId"=${locksGame.game.awayTeamId}`,
    ]);
  } else if (
    locksGame.game.homeTeamScore < locksGame.game.awayTeamScore
  ) {
    return prisma.$transaction([
      prisma.$executeRaw`UPDATE "LocksGamePick" SET "isScored" = true, "isWin" = 1, "isTie" = 0, "isLoss" = 0 WHERE "locksGameId"=${locksGame.id} AND "teamBetId"=${locksGame.game.awayTeamId}`,
      prisma.$executeRaw`UPDATE "LocksGamePick" SET "isScored" = true, "isWin" = 0, "isTie" = 0, "isLoss" = 1 WHERE "locksGameId"=${locksGame.id} AND "teamBetId"=${locksGame.game.homeTeamId}`,
    ]);
  } else {
    return prisma.$executeRaw`UPDATE "LocksGamePick" SET "isScored" = true, "isWin" = 0, "isTie" = 1, "isLoss" = 0 WHERE "locksGameId"=${locksGame.id}`;
  }
}
