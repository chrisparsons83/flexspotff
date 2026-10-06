import type { YahooUser } from '@prisma/client';
import { prisma } from '~/db.server';

export type { YahooUser } from '@prisma/client';

/**
 * Maps every linked Yahoo account to its member. A link left pointing at a
 * merged-away member resolves to whoever absorbed them, as Sleeper links do in
 * getOwnerToUserIdMap.
 */
export async function getYahooGuidToUserIdMap(): Promise<Map<string, string>> {
  const links = await prisma.yahooUser.findMany({
    include: { user: { select: { id: true, mergedIntoId: true } } },
  });
  return new Map(
    links.map(link => [link.yahooGuid, link.user.mergedIntoId ?? link.user.id]),
  );
}

export async function getYahooUserByGuid(yahooGuid: string) {
  return prisma.yahooUser.findUnique({
    where: { yahooGuid },
    include: { user: true },
  });
}

/**
 * Points a Yahoo account at a member and gives them every survivor entry that
 * account played.
 */
export async function matchYahooGuidToUser({ yahooGuid, userId }: YahooUser) {
  const [yahooUser, { count: survivorEntriesUpdated }] =
    await prisma.$transaction([
      prisma.yahooUser.upsert({
        where: { yahooGuid },
        update: { userId },
        create: { yahooGuid, userId },
      }),
      prisma.survivorEntry.updateMany({
        where: { yahooGuid },
        data: { userId },
      }),
    ]);
  return { yahooUser, survivorEntriesUpdated };
}
