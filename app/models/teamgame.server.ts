import type { League, TeamGame } from "@prisma/client";

import { prisma } from "~/db.server";

export type { TeamGame } from "@prisma/client";

type TeamGameUpsert = Omit<TeamGame, "id"> & Partial<Pick<TeamGame, "id">>;

export async function getTeamGameYearlyTotals(year: League["year"]) {
  return prisma.teamGame.groupBy({
    by: ["teamId"],
    _sum: {
      pointsScored: true,
    },
    orderBy: {
      _sum: {
        pointsScored: "desc",
      },
    },
  });
}

export async function getTeamGamesByYearAndWeek(
  year: League["year"],
  week: TeamGame["week"]
) {
  return prisma.teamGame.findMany({
    where: {
      week,
      team: {
        league: {
          year,
        },
      },
    },
  });
}

export async function upsertTeamGame(teamGame: TeamGameUpsert) {
  if (teamGame.id) {
    return prisma.teamGame.update({
      where: {
        id: teamGame.id,
      },
      data: teamGame,
    });
  } else {
    return prisma.teamGame.create({
      data: teamGame,
    });
  }
}
