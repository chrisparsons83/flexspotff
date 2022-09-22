import type { Cup, CupWeek } from "@prisma/client";

import { prisma } from "~/db.server";

export type { CupWeek } from "@prisma/client";

type CupWeekCreate = Omit<CupWeek, "id">;

export async function createCupWeek(data: CupWeekCreate) {
  return prisma.cupWeek.create({
    data,
  });
}

export async function getCupWeeks(cupId: Cup["id"]) {
  return prisma.cupWeek.findMany({
    where: {
      cupId,
    },
    orderBy: {
      week: "asc",
    },
  });
}

export async function updateCupWeek(id: Cup["id"], data: Partial<CupWeek>) {
  return prisma.cupWeek.update({
    where: {
      id,
    },
    data,
  });
}
