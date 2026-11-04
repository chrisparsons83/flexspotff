import { Prisma, type QBStreamingWeekOption } from '@prisma/client';
import { prisma } from '~/db.server';

export type { QBStreamingWeekOption } from '@prisma/client';

type QBStreamingWeekCreateInput = Omit<
  QBStreamingWeekOption,
  'id' | 'createdAt' | 'updatedAt' | 'removedAt'
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

/**
 * A week's options as the QB Streaming sync needs them: whose they are, which
 * pool, whether they are hidden, when the game starts and whether anybody has
 * picked them.
 */
export async function getQBStreamingWeekOptionsForSync(
  qbStreamingWeekId: QBStreamingWeekOption['qbStreamingWeekId'],
) {
  return prisma.qBStreamingWeekOption.findMany({
    where: { qbStreamingWeekId },
    select: {
      id: true,
      playerId: true,
      isDeep: true,
      removedAt: true,
      player: {
        select: { sleeperId: true, fullName: true, currentNFLTeamId: true },
      },
      nflGame: {
        select: {
          gameStartTime: true,
          homeTeamId: true,
          homeTeam: { select: { sleeperId: true } },
          awayTeam: { select: { sleeperId: true } },
        },
      },
      _count: {
        select: { StandardQBSelections: true, DeepQBSelections: true },
      },
    },
  });
}

export async function createQBStreamingWeekOptions(
  options: Pick<
    QBStreamingWeekOption,
    'qbStreamingWeekId' | 'playerId' | 'isDeep' | 'nflGameId'
  >[],
) {
  if (options.length === 0) return { count: 0 };

  // A QB already in the week is left as it is - pool included - rather than
  // failing the whole batch on the unique constraint.
  return prisma.qBStreamingWeekOption.createMany({
    data: options,
    skipDuplicates: true,
  });
}

/** Brings hidden options back, in the pool they were first added to. */
export async function restoreQBStreamingWeekOptions(
  ids: QBStreamingWeekOption['id'][],
) {
  if (ids.length === 0) return { count: 0 };

  return prisma.qBStreamingWeekOption.updateMany({
    where: { id: { in: ids }, removedAt: { not: null } },
    data: { removedAt: null },
  });
}

/**
 * Hides options nobody has picked, and returns the ones it hid.
 *
 * The "nobody has picked it" check is part of the same UPDATE, so an option
 * picked since the caller looked is skipped rather than hidden from under the
 * member who picked it. Hiding never deletes the row, so even a pick that lands
 * in the same instant keeps its option and still scores.
 */
export async function hideUnpickedQBStreamingWeekOptions(
  ids: QBStreamingWeekOption['id'][],
) {
  if (ids.length === 0) return [];

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "QBStreamingWeekOption" AS o
    SET "removedAt" = NOW()
    WHERE o."id" IN (${Prisma.join(ids)})
      AND o."removedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "QBSelection" AS s
        WHERE s."standardPlayerId" = o."id" OR s."deepPlayerId" = o."id"
      )
    RETURNING o."id"`;

  return rows.map(row => row.id);
}
