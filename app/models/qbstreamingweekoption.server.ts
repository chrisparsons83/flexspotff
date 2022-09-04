import type { QBStreamingWeekOption } from "@prisma/client";

import { prisma } from "~/db.server";

export type { QBStreamingWeekOption } from "@prisma/client";

type QBStreamingWeekCreateInput = Omit<
  QBStreamingWeekOption,
  "id" | "createdAt" | "updatedAt"
>;

export async function createQBStreamingWeekOption(
  qbStreamingWeekOption: QBStreamingWeekCreateInput
) {
  return prisma.qBStreamingWeekOption.create({
    data: qbStreamingWeekOption,
  });
}

export async function deleteQBStreamingWeekOption(
  id: QBStreamingWeekOption["id"]
) {
  return prisma.qBStreamingWeekOption.delete({
    where: {
      id,
    },
  });
}
