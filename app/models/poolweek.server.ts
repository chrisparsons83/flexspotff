import type { PoolWeek } from '@prisma/client';
import { prisma } from '~/db.server';

export type { PoolWeek } from '@prisma/client';

type PoolWeekCreateInput = Omit<PoolWeek, 'id' | 'createdAt' | 'updatedAt'>;

/** One game's line, in the shape the pool games table stores it. */
export type PoolLine = { gameId: string; homeSpread: number };

export async function createPoolWeek(poolWeek: PoolWeekCreateInput) {
  return prisma.poolWeek.create({
    data: poolWeek,
  });
}

export async function getPoolWeek(id: PoolWeek['id']) {
  return prisma.poolWeek.findUnique({
    where: {
      id,
    },
  });
}

export async function getPoolWeekByYearAndWeek(
  year: PoolWeek['year'],
  weekNumber: PoolWeek['weekNumber'],
) {
  return prisma.poolWeek.findFirst({
    where: {
      year,
      weekNumber,
    },
    orderBy: [
      {
        weekNumber: 'desc',
      },
    ],
  });
}

export async function getPoolWeeksByYear(year: PoolWeek['year']) {
  return prisma.poolWeek.findMany({
    where: {
      year,
    },
    orderBy: {
      weekNumber: 'desc',
    },
  });
}

export async function getNewestPoolWeekForYear(year: PoolWeek['year']) {
  return prisma.poolWeek.findFirst({
    where: {
      year,
    },
    orderBy: {
      weekNumber: 'desc',
    },
  });
}

export async function updatePoolWeek(poolWeek: PoolWeek) {
  return prisma.poolWeek.update({
    where: {
      id: poolWeek.id,
    },
    data: poolWeek,
  });
}

function upsertLine(poolWeekId: PoolWeek['id'], line: PoolLine) {
  return prisma.poolGame.upsert({
    where: { gameId: line.gameId },
    update: { homeSpread: line.homeSpread, poolWeekId },
    create: {
      gameId: line.gameId,
      homeSpread: line.homeSpread,
      poolWeekId,
    },
  });
}

async function createPoolWeekWithLines(
  year: PoolWeek['year'],
  weekNumber: PoolWeek['weekNumber'],
  lines: PoolLine[],
  isOpen: boolean,
) {
  // A nested create links the games in the same statement, so the week can
  // never exist without the lines it was created for.
  return prisma.poolWeek.create({
    data: {
      year,
      weekNumber,
      isOpen,
      isWeekScored: false,
      autoManaged: true,
      openAlertedAt: null,
      poolGames: {
        create: lines.map(line => ({
          gameId: line.gameId,
          homeSpread: line.homeSpread,
        })),
      },
    },
  });
}

/**
 * Creates a closed, automation-owned pool week and writes the lines known so
 * far in one statement. The automation uses this while it waits for the rest of
 * the slate's lines, so an admin can see the partial week and finish it by
 * hand.
 */
export async function createClosedPoolWeekWithLines(
  year: PoolWeek['year'],
  weekNumber: PoolWeek['weekNumber'],
  lines: PoolLine[],
) {
  return createPoolWeekWithLines(year, weekNumber, lines, false);
}

/**
 * Creates an automation-owned pool week, writes every line and opens it in one
 * statement. A crash cannot leave an open week without the slate it opened for.
 */
export async function createAndOpenPoolWeek(
  year: PoolWeek['year'],
  weekNumber: PoolWeek['weekNumber'],
  lines: PoolLine[],
) {
  return createPoolWeekWithLines(year, weekNumber, lines, true);
}

/**
 * Writes the lines now known into an existing closed week without opening it.
 */
export async function writeClosedPoolWeekLines(
  poolWeek: PoolWeek,
  lines: PoolLine[],
) {
  if (lines.length === 0) return poolWeek;

  await prisma.$transaction(lines.map(line => upsertLine(poolWeek.id, line)));
  return poolWeek;
}

/**
 * Writes every line and opens the week in one transaction, clearing any
 * first-failure marker so a later failure this season can alert again.
 */
export async function openPoolWeekWithLines(
  poolWeek: PoolWeek,
  lines: PoolLine[],
) {
  const results = await prisma.$transaction([
    ...lines.map(line => upsertLine(poolWeek.id, line)),
    prisma.poolWeek.update({
      where: { id: poolWeek.id },
      data: { isOpen: true, openAlertedAt: null },
    }),
  ]);

  return results[results.length - 1];
}

/**
 * Records that the first failed open for a week has been alerted. Later runs
 * see this and stay quiet; opening the week clears it.
 */
export async function markPoolWeekOpenAlerted(
  poolWeek: PoolWeek,
  alertedAt = new Date(),
) {
  return prisma.poolWeek.update({
    where: { id: poolWeek.id },
    data: { openAlertedAt: alertedAt },
  });
}
