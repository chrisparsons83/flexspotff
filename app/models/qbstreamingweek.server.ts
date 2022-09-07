import type { QBStreamingWeek } from "@prisma/client";

import { prisma } from "~/db.server";

export type { QBStreamingWeek } from "@prisma/client";

type QBStreamingWeekCreateInput = Omit<
  QBStreamingWeek,
  "id" | "createdAt" | "updatedAt"
>;

export async function createQBStreamingWeek(
  qbStreamingWeek: QBStreamingWeekCreateInput
) {
  return prisma.qBStreamingWeek.create({
    data: qbStreamingWeek,
  });
}

export async function getQBStreamingWeek(id: QBStreamingWeek["id"]) {
  return prisma.qBStreamingWeek.findUnique({
    where: {
      id,
    },
    include: {
      QBStreamingWeekOptions: {
        include: {
          player: true,
          nflGame: {
            include: {
              homeTeam: true,
              awayTeam: true,
            },
          },
        },
        orderBy: [
          {
            player: {
              lastName: "asc",
            },
          },
          {
            player: {
              firstName: "asc",
            },
          },
        ],
      },
    },
  });
}

export async function getQBStreamingWeeks(year: QBStreamingWeek["year"]) {
  return prisma.qBStreamingWeek.findMany({
    where: {
      year,
    },
    orderBy: {
      week: "desc",
    },
  });
}

export async function updateQBStreamingWeek(qbStreamingWeek: QBStreamingWeek) {
  return prisma.qBStreamingWeek.update({
    where: {
      id: qbStreamingWeek.id,
    },
    data: qbStreamingWeek,
  });
}
