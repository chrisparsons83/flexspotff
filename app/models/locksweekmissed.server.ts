import { prisma } from "~/db.server";

import type { LocksWeek } from "./locksweek.server";
import type { User } from "./user.server";

export async function createLocksWeekMissed(
  userId: User["id"],
  locksWeekId: LocksWeek["id"]
) {
  return prisma.locksWeekMissed.create({
    data: { userId, locksWeekId },
  });
}

export async function getLocksWeekMissedByUserAndYear(
  userId: User["id"],
  year: LocksWeek["year"]
) {
  return prisma.locksWeekMissed.findMany({
    where: {
      userId,
      locksWeek: {
        year,
      },
    },
    include: {
        locksWeek: true,
    },
  });
}

export async function getLocksWeekMissedTotalByUserAndYear(
  year: LocksWeek["year"]
) {
  return prisma.locksWeekMissed.groupBy({
    where: {
        locksWeek: {
        year,
      },
    },
    by: ["userId"],
  });
}

export async function getLocksWeekMissedTotalByUserAndYearAndWeek(
  year: LocksWeek["year"],
  weekNumber: LocksWeek["weekNumber"]
) {
  return prisma.locksWeekMissed.groupBy({
    where: {
      locksWeek: {
        year,
        weekNumber,
      },
    },
    by: ["userId"],
    _sum: {
      isLoss: true,
      isTie: true,
      isWin: true,
    },
  });
}
