import type { PoolWeek } from "@prisma/client";

import { prisma } from "~/db.server";

export type { PoolWeek } from "@prisma/client";

type PoolWeekCreateInput = Omit<PoolWeek, "id" | "createdAt" | "updatedAt">;

export async function createPoolWeek(poolWeek: PoolWeekCreateInput) {
  return prisma.poolWeek.create({
    data: poolWeek,
  });
}

export async function getPoolWeeksByYear(year: PoolWeek["year"]) {
  return prisma.poolWeek.findMany({
    where: {
      year,
    },
    orderBy: {
      weekNumber: "desc",
    },
  });
}

export async function getNewestPoolWeekForYear(year: PoolWeek["year"]) {
  return prisma.poolWeek.findFirst({
    where: {
      year,
    },
    orderBy: {
      weekNumber: "desc",
    },
  });
}
