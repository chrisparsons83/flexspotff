import { prisma } from '~/db.server';

export async function upsertD12DraftPicksForLeague(
  d12LeagueId: string,
  picks: Array<{ sleeperId: string; pickNo: number; userId: string | null }>,
) {
  return prisma.$transaction(
    picks.map(pick =>
      prisma.d12DraftPick.upsert({
        where: {
          d12LeagueId_sleeperId: { d12LeagueId, sleeperId: pick.sleeperId },
        },
        create: {
          d12LeagueId,
          sleeperId: pick.sleeperId,
          pickNo: pick.pickNo,
          userId: pick.userId,
        },
        update: { pickNo: pick.pickNo, userId: pick.userId },
      }),
    ),
  );
}

export async function getD12DraftPicksForLeagues(leagueIds: string[]) {
  return prisma.d12DraftPick.findMany({
    where: { d12LeagueId: { in: leagueIds } },
    include: {
      league: { select: { id: true, name: true } },
      user: { select: { discordName: true } },
    },
  });
}

export async function getD12DraftPicksByUserAndLeagues(
  userId: string,
  leagueIds: string[],
) {
  return prisma.d12DraftPick.findMany({
    where: { userId, d12LeagueId: { in: leagueIds } },
  });
}
