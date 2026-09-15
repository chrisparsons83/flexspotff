import type { WaiverReport, WaiverTransaction } from '@prisma/client';
import { prisma } from '~/db.server';

export type { WaiverReport, WaiverTransaction } from '@prisma/client';

export type WaiverTransactionCreateInput = Omit<
  WaiverTransaction,
  'id' | 'createdAt' | 'updatedAt'
>;

type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;
export type WaiverTransactionWithRelations = ArrElement<
  Awaited<ReturnType<typeof getWaiverTransactions>>
>;

/**
 * Replaces everything stored for one league-week with the given batch.
 *
 * Upserting alone was not enough to make a re-sync idempotent. If a sync ever
 * stores a different batch under the same week - which a week-boundary mistake
 * makes easy - the two sets pile up and render as one report: the footer
 * double-counts, and a second winning claim for the same player is drawn in the
 * losers list as though that manager had been outbid. Deleting whatever is no
 * longer part of the batch, in the same transaction as the writes, means a week
 * always holds exactly one batch.
 */
export async function replaceWaiverTransactions(
  leagueId: WaiverTransaction['leagueId'],
  week: WaiverTransaction['week'],
  transactions: WaiverTransactionCreateInput[],
) {
  const keep = transactions.map(
    transaction => transaction.sleeperTransactionId,
  );

  return prisma.$transaction([
    prisma.waiverTransaction.deleteMany({
      where: {
        leagueId,
        week,
        sleeperTransactionId: { notIn: keep },
      },
    }),
    ...transactions.map(transaction =>
      prisma.waiverTransaction.upsert({
        where: {
          leagueId_sleeperTransactionId: {
            leagueId: transaction.leagueId,
            sleeperTransactionId: transaction.sleeperTransactionId,
          },
        },
        update: transaction,
        create: transaction,
      }),
    ),
  ]);
}

/**
 * Ordered the way Sleeper resolves a claim: highest bid first, and on a tie the
 * lower `seq` - the manager with better waiver priority - wins.
 */
export async function getWaiverTransactions(
  leagueId: WaiverTransaction['leagueId'],
  week: WaiverTransaction['week'],
) {
  return prisma.waiverTransaction.findMany({
    where: {
      leagueId,
      week,
    },
    include: {
      user: true,
      addPlayer: true,
      dropPlayer: true,
    },
    orderBy: [{ bid: 'desc' }, { seq: 'asc' }],
  });
}

export async function getWaiverTransactionsByYear(year: number) {
  return prisma.waiverTransaction.findMany({
    where: {
      league: {
        year,
      },
    },
    include: {
      user: true,
      addPlayer: true,
      dropPlayer: true,
      league: true,
    },
    orderBy: [{ week: 'desc' }, { bid: 'desc' }, { seq: 'asc' }],
  });
}

export async function getWaiverReport(
  leagueId: WaiverReport['leagueId'],
  week: WaiverReport['week'],
) {
  return prisma.waiverReport.findUnique({
    where: {
      leagueId_week: {
        leagueId,
        week,
      },
    },
  });
}

export async function getWaiverReportsByYear(year: number) {
  return prisma.waiverReport.findMany({
    where: {
      league: {
        year,
      },
    },
    include: {
      league: true,
    },
  });
}

/**
 * Marks a league-week as posted. Upserts rather than creates so that an admin
 * re-run updates the existing row instead of failing on the unique constraint.
 */
export async function recordWaiverReport({
  leagueId,
  week,
  discordMessageId,
}: {
  leagueId: WaiverReport['leagueId'];
  week: WaiverReport['week'];
  discordMessageId?: WaiverReport['discordMessageId'];
}) {
  return prisma.waiverReport.upsert({
    where: {
      leagueId_week: {
        leagueId,
        week,
      },
    },
    update: {
      postedAt: new Date(),
      discordMessageId: discordMessageId ?? null,
    },
    create: {
      leagueId,
      week,
      discordMessageId: discordMessageId ?? null,
    },
  });
}

/** Distinct weeks that have stored claims, for the admin page's week picker. */
export async function getWaiverWeeksWithData(year: number) {
  const weeks = await prisma.waiverTransaction.findMany({
    where: {
      league: {
        year,
      },
    },
    distinct: ['week'],
    select: {
      week: true,
    },
    orderBy: {
      week: 'desc',
    },
  });

  return weeks.map(({ week }) => week);
}
