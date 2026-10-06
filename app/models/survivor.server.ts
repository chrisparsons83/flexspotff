import { prisma } from '~/db.server';

export type { SurvivorEntry, SurvivorPick, SurvivorPool } from '@prisma/client';

const entryMember = {
  select: { id: true, discordName: true, discordUsername: true },
} as const;

/** Newest season first, and within a season in the order the pools ran. */
const poolOrder = [{ year: 'desc' }, { startWeek: 'asc' }] as const;

/** Every pool with how many of its entries are matched, for the admin list. */
export async function getSurvivorPoolsForAdmin() {
  return prisma.survivorPool.findMany({
    orderBy: [...poolOrder],
    include: { entries: { select: { userId: true } } },
  });
}

export async function getSurvivorPoolById(id: string) {
  return prisma.survivorPool.findUnique({ where: { id } });
}

/** A pool with every entry, its member and its picks, for its own page. */
export async function getSurvivorPoolWithEntries(id: string) {
  return prisma.survivorPool.findUnique({
    where: { id },
    include: {
      entries: {
        include: {
          user: entryMember,
          picks: { orderBy: { week: 'asc' } },
        },
      },
    },
  });
}

/** Every pool with its winners and how many entered, for the history page. */
export async function getSurvivorHistory() {
  return prisma.survivorPool.findMany({
    orderBy: [...poolOrder],
    include: {
      entries: {
        select: {
          finish: true,
          eliminatedWeek: true,
          survivedWeek: true,
          displayName: true,
          user: entryMember,
          picks: { select: { result: true, week: true } },
        },
      },
    },
  });
}

/** Every pool, for the pool switcher. */
export async function getAllSurvivorPools() {
  return prisma.survivorPool.findMany({
    orderBy: [...poolOrder],
    select: { id: true, name: true, year: true, isComplete: true },
  });
}

/** The newest season's pools, in the order they ran, for the Games sidebar. */
export async function getLatestSurvivorPools() {
  const latest = await prisma.survivorPool.findFirst({
    orderBy: { year: 'desc' },
    select: { year: true },
  });
  if (!latest) return [];
  return prisma.survivorPool.findMany({
    where: { year: latest.year },
    orderBy: { startWeek: 'asc' },
    select: { id: true, name: true, year: true },
  });
}

export async function setSurvivorInviteUrl(id: string, inviteUrl: string) {
  return prisma.survivorPool.update({
    where: { id },
    data: { inviteUrl: inviteUrl || null },
  });
}

/**
 * Sets, or clears with null, the member for an entry with no account to match
 * on: a Sleeper roster its owner left, or a Yahoo account Yahoo has closed.
 *
 * @returns how many entries changed - 0 if the entry is gone, is in another
 * pool, or has an account after all.
 */
export async function assignUnlinkedSurvivorEntry({
  survivorPoolId,
  entryId,
  userId,
}: {
  survivorPoolId: string;
  entryId: string;
  userId: string | null;
}) {
  const { count } = await prisma.survivorEntry.updateMany({
    where: {
      id: entryId,
      survivorPoolId,
      sleeperOwnerId: null,
      yahooGuid: null,
    },
    data: { userId },
  });
  return count;
}

export async function deleteSurvivorPool(id: string) {
  return prisma.survivorPool.delete({ where: { id } });
}

/**
 * Who each Sleeper display name belongs to, from the Sleeper pools already
 * matched. Yahoo pick sets are often named after the same handle
 * ("CodeMonkey's Survival"), which makes this the best hint for a Yahoo entry.
 */
export async function getSleeperNamesOfMembers() {
  const rows = await prisma.survivorEntry.findMany({
    where: {
      sleeperOwnerId: { not: null },
      displayName: { not: null },
      userId: { not: null },
    },
    select: { displayName: true, userId: true },
    distinct: ['displayName', 'userId'],
  });
  return rows as { displayName: string; userId: string }[];
}
