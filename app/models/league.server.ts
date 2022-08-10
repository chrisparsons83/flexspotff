import type { League } from "@prisma/client";
import { prisma } from "~/db.server";
export type { League } from "@prisma/client";

type LeagueCreateInput = Omit<League, "id" | "createdAt" | "updatedAt">;

export async function createLeague(league: LeagueCreateInput) {
  return prisma.league.create({
    data: league,
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
