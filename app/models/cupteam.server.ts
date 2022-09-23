import type { CupTeam } from "@prisma/client";

import { prisma } from "~/db.server";

export type { CupTeam } from "@prisma/client";

type CupTeamCreate = Omit<CupTeam, "id">;

export async function createCupTeam(data: CupTeamCreate) {
  return prisma.cupTeam.create({
    data,
  });
}
