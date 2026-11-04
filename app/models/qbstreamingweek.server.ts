import type { QBStreamingWeek, User } from '@prisma/client';
import { prisma } from '~/db.server';

export type { QBStreamingWeek } from '@prisma/client';

type QBStreamingWeekCreateInput = Omit<
  QBStreamingWeek,
  'id' | 'createdAt' | 'updatedAt'
>;

export type QBStreamingStandingsRow = {
  rank?: number;
  discordName: User['discordName'];
  discordUsername: User['discordUsername'];
  userId: User['id'];
  pointsScored: number;
};

export async function createQBStreamingWeek(
  qbStreamingWeek: QBStreamingWeekCreateInput,
) {
  return prisma.qBStreamingWeek.create({
    data: qbStreamingWeek,
  });
}

export async function getQBStreamingWeek(id: QBStreamingWeek['id']) {
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
              lastName: 'asc',
            },
          },
          {
            player: {
              firstName: 'asc',
            },
          },
        ],
      },
    },
  });
}

export async function getQBStreamingWeeks(year: QBStreamingWeek['year']) {
  return prisma.qBStreamingWeek.findMany({
    where: {
      year,
    },
    orderBy: {
      week: 'desc',
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

/** Every season with at least one QB streaming week, newest first. */
export async function getQBStreamingYears() {
  const years = await prisma.qBStreamingWeek.groupBy({
    by: ['year'],
    orderBy: { year: 'desc' },
  });

  return years.map(({ year }) => year);
}

export async function getQBStreamingWeekByYearAndWeek(
  year: QBStreamingWeek['year'],
  week: QBStreamingWeek['week'],
) {
  return prisma.qBStreamingWeek.findFirst({ where: { year, week } });
}

/**
 * Creates a closed week unless one already exists for that year and week,
 * returning it, or null when another run got there first. Two syncs - the
 * scheduled run and a manual "Run Now" - can both find no week at the same
 * moment, and the table has no unique key to stop both creating one, so the
 * insert takes a lock and checks again inside the same transaction.
 */
export async function createQBStreamingWeekIfMissing(
  year: QBStreamingWeek['year'],
  week: QBStreamingWeek['week'],
): Promise<QBStreamingWeek | null> {
  const [, rows] = await prisma.$transaction([
    prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`qb-streaming-week:${year}`}))`,
    prisma.$queryRaw<QBStreamingWeek[]>`
      INSERT INTO "QBStreamingWeek" ("id", "year", "week", "isOpen", "isScored")
      SELECT gen_random_uuid()::text, ${year}, ${week}, false, false
      WHERE NOT EXISTS (
        SELECT 1 FROM "QBStreamingWeek" WHERE "year" = ${year} AND "week" = ${week}
      )
      RETURNING *`,
  ]);

  return rows[0] ?? null;
}

export async function deleteQBStreamingWeek(id: QBStreamingWeek['id']) {
  return prisma.qBStreamingWeek.delete({ where: { id } });
}
