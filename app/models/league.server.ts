import type { League } from "@prisma/client";

import { prisma } from "~/db.server";

export type { League } from "@prisma/client";

type LeagueCreateInput = Omit<League, "id" | "createdAt" | "updatedAt">;

export async function createLeague(league: LeagueCreateInput) {
  return prisma.league.create({
    data: league,
  });
}

export async function getLeague(id: League["id"]) {
  return prisma.league.findUnique({
    where: {
      id,
    },
  });
}

export async function getLeagues() {
  return prisma.league.findMany({
    orderBy: [
      {
        year: "desc",
      },
      {
        tier: "asc",
      },
      {
        name: "asc",
      },
    ],
  });
}

export async function getLeaguesByYear(year: League["year"]) {
  return prisma.league.findMany({
    where: {
      year,
    },
    orderBy: [
      {
        year: "desc",
      },
      {
        tier: "asc",
      },
      {
        name: "asc",
      },
    ],
    include: {
      teams: true,
    },
  });
}

export async function updateLeague(league: Partial<League>) {
  return prisma.league.update({
    where: {
      id: league.id,
    },
    data: league,
  });
}
