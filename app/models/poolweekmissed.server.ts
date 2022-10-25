import { prisma } from "~/db.server";

import type { PoolWeek } from "./poolweek.server";
import type { User } from "./user.server";

export async function createPoolWeekMissed(
  userId: User["id"],
  poolWeekId: PoolWeek["id"]
) {
  return prisma.poolWeekMissed.create({
    data: { userId, poolWeekId },
  });
}

export async function getPoolWeekMissedByUserAndYear(
  userId: User["id"],
  year: PoolWeek["year"]
) {
  return prisma.poolWeekMissed.findMany({
    where: {
      userId,
      poolWeek: {
        year,
      },
    },
    include: {
      poolWeek: true,
    },
  });
}

export async function getPoolWeekMissedTotalByUserAndYear(
  year: PoolWeek["year"]
) {
  return prisma.poolWeekMissed.groupBy({
    where: {
      poolWeek: {
        year,
      },
    },
    by: ["userId"],
    _sum: {
      resultWonLoss: true,
    },
  });
}

export async function getPoolWeekMissedTotalByUserAndYearAndWeek(
  year: PoolWeek["year"],
  weekNumber: PoolWeek["weekNumber"]
) {
  return prisma.poolWeekMissed.groupBy({
    where: {
      poolWeek: {
        year,
        weekNumber,
      },
    },
    by: ["userId"],
    _sum: {
      amountBet: true,
      resultWonLoss: true,
      isLoss: true,
      isTie: true,
      isWin: true,
    },
  });
}
