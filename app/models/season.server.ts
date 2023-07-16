import type { Season } from "@prisma/client";

import { prisma } from "~/db.server";

export type { Season } from "@prisma/client";

export type SeasonCreate = Omit<Season, "id" | "createdAt" | "updatedAt">;

export async function createSeason(data: SeasonCreate) {
  return prisma.season.create({
    data,
  });
}

export async function getCurrentSeason() {
  return prisma.season.findFirst({
    where: {
      isCurrent: true,
    },
  });
}

export async function getSeasons() {
  return prisma.season.findMany({
    orderBy: [
      {
        year: "desc",
      },
    ],
  });
}

export async function updateSeason(season: Partial<Season>) {
  return prisma.season.update({
    where: {
      id: season.id,
    },
    data: season,
  });
}

export async function updateActiveSeason(id: Season["id"]) {
  return prisma.$transaction([
    prisma.season.updateMany({
      data: {
        isCurrent: false,
      },
    }),
    prisma.season.update({
      where: {
        id: id,
      },
      data: {
        isCurrent: true,
      },
    }),
  ]);
}
