import type { League, Team } from "@prisma/client";
import { prisma } from "~/db.server";
export type { Team } from "@prisma/client";

type TeamCreateInput = Omit<Team, "id" | "createdAt" | "updatedAt">;
type TeamUpdateInput = Omit<Team, "createdAt" | "updatedAt">;

export async function createTeam(team: TeamCreateInput) {
  return prisma.team.create({
    data: team,
  });
}

export async function getTeamBySleeperOwnerLeagueId(
  sleeperOwnerId: string,
  leagueId: string
) {
  return prisma.team.findFirst({
    where: {
      sleeperOwnerId,
      leagueId,
    },
  });
}

export async function getTeams(leagueId: League["id"]) {
  return prisma.team.findMany({
    where: {
      leagueId,
    },
  });
}

export async function updateTeam(team: TeamUpdateInput) {
  return prisma.team.update({
    where: {
      id: team.id,
    },
    data: team,
  });
}
