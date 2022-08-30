import type { PoolGamePick } from "@prisma/client";

import type { PoolWeek } from "~/models/poolweek.server";
import type { User } from "~/models/user.server";

import { prisma } from "~/db.server";

export type { PoolGamePick } from "@prisma/client";

export type PoolGamePickCreate = Omit<
  PoolGamePick,
  "id" | "createdAt" | "updatedAt" | "resultWonLoss"
>;

export async function createPoolGamePick(poolGamePick: PoolGamePickCreate) {
  return prisma.poolGamePick.create({
    data: poolGamePick,
  });
}

export async function createPoolGamePicks(poolGamePicks: PoolGamePickCreate[]) {
  return prisma.poolGamePick.createMany({
    data: poolGamePicks,
    skipDuplicates: true,
  });
}

export async function deletePoolGamePicksForUserAndWeek(
  user: User,
  poolWeek: PoolWeek
) {
  return prisma.poolGamePick.deleteMany({
    where: {
      userId: user.id,
      poolGame: {
        poolWeekId: poolWeek.id,
      },
    },
  });
}

export async function getPoolGamePicksByUserAndPoolWeek(
  user: User,
  poolWeek: PoolWeek
) {
  return prisma.poolGamePick.findMany({
    where: {
      userId: user.id,
      poolGame: {
        poolWeekId: poolWeek.id,
      },
    },
  });
}
