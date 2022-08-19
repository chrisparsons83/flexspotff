import type { DraftPick, League } from "@prisma/client";

import { prisma } from "~/db.server";

export type { DraftPick } from "@prisma/client";

export type DraftPickCreate = Omit<DraftPick, "id">;

export async function createDraftPick(draftPick: DraftPickCreate) {
  return prisma.draftPick.create({
    data: draftPick,
  });
}

export async function deleteDraftPicks(ids: DraftPick["id"][]) {
  return prisma.draftPick.deleteMany({
    where: {
      id: {
        in: ids,
      },
    },
  });
}

export async function getDraftPicks(id: League["id"]) {
  return prisma.league.findUnique({
    where: {
      id,
    },
    select: {
      teams: {
        select: {
          DraftPicks: true,
        },
      },
    },
  });
}
