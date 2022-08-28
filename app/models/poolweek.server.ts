import type { PoolWeek } from "@prisma/client";

import { prisma } from "~/db.server";

export type { PoolWeek } from "@prisma/client";

type PoolWeekCreateInput = Omit<PoolWeek, "id" | "createdAt" | "updatedAt">;

export async function createPoolWeek(poolWeek: PoolWeekCreateInput) {
  return prisma.poolWeek.create({
    data: poolWeek,
  });
}

export async function getPoolWeekByYearAndWeek(
  year: PoolWeek["year"],
  weekNumber: PoolWeek["weekNumber"]
) {
  return prisma.poolWeek.findFirst({
    where: {
      year,
      weekNumber,
    },
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

export async function updatePoolWeek(poolWeek: PoolWeek) {
  return prisma.poolWeek.update({
    where: {
      id: poolWeek.id,
    },
    data: poolWeek,
  });
}
