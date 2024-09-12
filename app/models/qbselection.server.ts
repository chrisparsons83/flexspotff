import type { QBSelection, QBStreamingWeek } from '@prisma/client';
import { prisma } from '~/db.server';
import type { User } from '~/models/user.server';

export type { QBSelection } from '@prisma/client';

type QBSelectionCreate = Omit<QBSelection, 'id'>;

export async function createQBSelection(qbSelection: QBSelectionCreate) {
  return prisma.qBSelection.create({
    data: qbSelection,
  });
}

export async function getQBSelection(
  qbStreamingWeekId: QBStreamingWeek['id'],
  userId: User['id'],
) {
  return prisma.qBSelection.findFirst({
    where: {
      qbStreamingWeekId,
      userId,
    },
    include: {
      standardPlayer: {
        include: {
          nflGame: true,
        },
      },
      deepPlayer: {
        include: {
          nflGame: true,
        },
      },
    },
  });
}

export async function getQBSelectionsByWeek(
  qbStreamingWeekId: QBStreamingWeek['id'],
) {
  return prisma.qBSelection.findMany({
    where: {
      qbStreamingWeekId,
    },
    include: {
      standardPlayer: {
        include: {
          player: true,
          nflGame: true,
        },
      },
      deepPlayer: {
        include: {
          player: true,
          nflGame: true,
        },
      },
      user: true,
    },
  });
}

export async function getQBSelectionsByYear(year: QBStreamingWeek['year']) {
  return prisma.qBSelection.findMany({
    where: {
      qbStreamingWeek: {
        year,
      },
    },
    include: {
      deepPlayer: true,
      standardPlayer: true,
      user: true,
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
