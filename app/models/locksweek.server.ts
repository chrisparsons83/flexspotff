import type { LocksWeek } from '@prisma/client';
import { prisma } from '~/db.server';

export type { LocksWeek } from '@prisma/client';

type LocksWeekCreateInput = Omit<LocksWeek, 'id' | 'createdAt' | 'updatedAt'>;

export async function createLocksWeek(locksWeek: LocksWeekCreateInput) {
  return prisma.locksWeek.create({
    data: locksWeek,
  });
}

export async function getLocksWeek(id: LocksWeek['id']) {
  return prisma.locksWeek.findUnique({
    where: {
      id,
    },
  });
}

export async function getLocksWeekByYearAndWeek(
  year: LocksWeek['year'],
  weekNumber: LocksWeek['weekNumber'],
) {
  return prisma.locksWeek.findFirst({
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

export async function getLocksWeeksByYear(year: LocksWeek['year']) {
  return prisma.locksWeek.findMany({
    where: {
      year,
    },
    orderBy: {
      weekNumber: 'desc',
    },
  });
}

export async function getNewestLocksWeekForYear(year: LocksWeek['year']) {
  return prisma.locksWeek.findFirst({
    where: {
      year,
    },
    orderBy: {
      weekNumber: 'desc',
    },
  });
}

export async function updateLocksWeek(locksWeek: LocksWeek) {
  return prisma.locksWeek.update({
    where: {
      id: locksWeek.id,
    },
    data: locksWeek,
  });
}

/**
 * Creates a Locks week, links every NFL game of its week and opens it in one
 * transaction.
 *
 * A crash part-way through must not leave a closed week behind: the next run
 * would find it, and an admin would have to finish it by hand. The automation
 * owns the week it creates, and nothing here ever clears `autoManaged`.
 */
export async function createAndOpenLocksWeek(
  year: LocksWeek['year'],
  weekNumber: LocksWeek['weekNumber'],
  nflGameIds: string[],
) {
  const [locksWeek] = await prisma.$transaction([
    // A nested create links the games in the same statement, so the week can
    // never exist without the slate it was opened for.
    prisma.locksWeek.create({
      data: {
        year,
        weekNumber,
        isOpen: true,
        isWeekScored: false,
        autoManaged: true,
        locksGames: {
          create: nflGameIds.map(gameId => ({
            game: { connect: { id: gameId } },
          })),
        },
      },
    }),
  ]);

  return locksWeek;
}

/**
 * Links every NFL game of an automation-owned closed Locks week and opens it in
 * one transaction, so a crash cannot leave the week half-linked or reopened
 * without its slate. Opening clears any first-failure marker so a later failure
 * this season can alert again.
 */
export async function openLocksWeekWithGames(
  locksWeek: LocksWeek,
  nflGameIds: string[],
) {
  const results = await prisma.$transaction([
    ...nflGameIds.map(gameId =>
      prisma.locksGame.upsert({
        where: { gameId },
        update: { locksWeekId: locksWeek.id },
        create: { gameId, locksWeekId: locksWeek.id },
      }),
    ),
    prisma.locksWeek.update({
      where: { id: locksWeek.id },
      data: { isOpen: true, openAlertedAt: null },
    }),
  ]);

  return results[results.length - 1];
}

/**
 * Records that the first failed open for a week has been alerted. Later runs
 * see this and stay quiet; opening the week clears it.
 */
export async function markLocksWeekOpenAlerted(
  locksWeek: LocksWeek,
  alertedAt = new Date(),
) {
  return prisma.locksWeek.update({
    where: { id: locksWeek.id },
    data: { openAlertedAt: alertedAt },
  });
}
