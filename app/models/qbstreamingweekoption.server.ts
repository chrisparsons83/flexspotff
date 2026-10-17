import type { QBStreamingWeekOption } from '@prisma/client';
import { prisma } from '~/db.server';

export type { QBStreamingWeekOption } from '@prisma/client';

type QBStreamingWeekCreateInput = Omit<
  QBStreamingWeekOption,
  'id' | 'createdAt' | 'updatedAt'
>;

export async function createQBStreamingWeekOption(
  qbStreamingWeekOption: QBStreamingWeekCreateInput,
) {
  return prisma.qBStreamingWeekOption.create({
    data: qbStreamingWeekOption,
  });
}

export async function deleteQBStreamingWeekOption(
  id: QBStreamingWeekOption['id'],
) {
  return prisma.qBStreamingWeekOption.delete({
    where: {
      id,
    },
  });
}

export async function updateQBStreamingWeekOptionScore(
  id: QBStreamingWeekOption['id'],
  pointsScored: QBStreamingWeekOption['pointsScored'],
) {
  return prisma.qBStreamingWeekOption.update({
    where: {
      id,
    },
    data: {
      pointsScored,
    },
  });
}

/**
 * QB Streaming options in unscored weeks of a year, with the week their saved
 * game is in and the QB's team, so an option saved against a game Sleeper
 * later dropped or moved can be pointed at the QB's real game.
 */
export async function getUnscoredQBStreamingWeekOptions(year: number) {
  return prisma.qBStreamingWeekOption.findMany({
    where: { qbStreamingWeek: { year, isScored: false } },
    include: {
      qbStreamingWeek: { select: { year: true, week: true } },
      nflGame: { select: { year: true, week: true } },
      player: { select: { currentNFLTeamId: true } },
    },
  });
}

export async function updateQBStreamingWeekOptionGame(
  id: QBStreamingWeekOption['id'],
  nflGameId: QBStreamingWeekOption['nflGameId'],
) {
  return prisma.qBStreamingWeekOption.update({
    where: { id },
    data: { nflGameId },
  });
}

/**
 * Deleting an option also deletes every selection made with it.
 */
export async function deleteQBStreamingWeekOptions(
  ids: QBStreamingWeekOption['id'][],
) {
  if (ids.length === 0) return { count: 0 };

  return prisma.qBStreamingWeekOption.deleteMany({
    where: { id: { in: ids } },
  });
}
