import type { QBSelection, QBStreamingWeek } from "@prisma/client";

import type { User } from "~/models/user.server";

import { prisma } from "~/db.server";

export type { QBSelection } from "@prisma/client";

type QBSelectionCreate = Omit<QBSelection, "id">;

export async function createQBSelection(qbSelection: QBSelectionCreate) {
  return prisma.qBSelection.create({
    data: qbSelection,
  });
}

export async function getQBSelection(
  qbStreamingWeekId: QBStreamingWeek["id"],
  userId: User["id"]
) {
  return prisma.qBSelection.findFirst({
    where: {
      qbStreamingWeekId,
      userId,
    },
  });
}

export async function updateQBSelection(qbSelection: QBSelection) {
  return prisma.qBSelection.update({
    where: {
      id: qbSelection.id,
    },
    data: qbSelection,
  });
}
