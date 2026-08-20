import type { User } from '@prisma/client';
import { prisma } from '~/db.server';

export type { User } from '@prisma/client';

export async function getUserById(id: User['id']) {
  return prisma.user.findUnique({ where: { id } });
}

/**
 * Looks a member up by the Discord account that just logged in, following a
 * single merge hop.
 *
 * A merged-away account keeps its row so its discordId stays claimed. Without
 * resolving it here, that person would be handed a fresh split identity every
 * time they logged in with the account that was merged away - which is exactly
 * how the duplicates this resolves got created in the first place.
 */
export async function getUserByDiscordId(discordId: User['discordId']) {
  const user = await prisma.user.findUnique({ where: { discordId } });

  if (!user?.mergedIntoId) {
    return user;
  }

  // A merge refuses to point at a tombstone and re-points existing tombstones
  // at the new canonical member, so this is always at most one hop.
  return prisma.user.findUnique({ where: { id: user.mergedIntoId } });
}

export async function createUser(
  discordId: User['discordId'],
  discordName: User['discordName'],
  discordAvatar: User['discordAvatar'],
) {
  return prisma.user.create({
    data: {
      discordId,
      discordName,
      discordAvatar,
    },
  });
}

export async function deleteUserByDiscordId(discordId: User['discordId']) {
  return prisma.user.delete({ where: { discordId } });
}

export async function getUser(id: User['id']) {
  return prisma.user.findUnique({
    where: {
      id,
    },
  });
}

export async function getUsersByIds(ids: User['id'][]) {
  return prisma.user.findMany({
    where: {
      id: { in: ids },
    },
  });
}

/**
 * Every member who is still their own person. Merged-away accounts are left
 * out: they exist only to redirect a login, and offering one in a picker would
 * let an admin attach new history to an account nobody can reach.
 */
export async function getUsers() {
  return prisma.user.findMany({
    where: {
      mergedIntoId: null,
    },
    orderBy: {
      discordName: 'asc',
    },
    include: {
      sleeperUsers: true,
    },
  });
}

/** Members including merged-away ones, for admin screens that manage them. */
export async function getUsersIncludingMerged() {
  return prisma.user.findMany({
    orderBy: {
      discordName: 'asc',
    },
    include: {
      sleeperUsers: true,
      mergedInto: {
        select: {
          id: true,
          discordName: true,
        },
      },
    },
  });
}

export async function updateUser(user: Partial<User>) {
  return prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      discordName: user.discordName || undefined,
      discordAvatar: user.discordAvatar || undefined,
      discordRoles: user.discordRoles || undefined,
    },
  });
}

/**
 * Finds the member this Discord login belongs to, creating them on first sight,
 * and refreshes their stored profile.
 *
 * Lives here rather than in the strategy callback so the merged-account case is
 * testable: getUserByDiscordId resolves a merged-away account to the member who
 * absorbed it, and that member's row must not be overwritten with the profile
 * of the account that just signed in.
 */
export async function resolveMemberForLogin({
  discordId,
  discordName,
  discordAvatar,
  discordRoles,
}: {
  discordId: string;
  discordName: string;
  discordAvatar: string;
  discordRoles: string[];
}) {
  const user =
    (await getUserByDiscordId(discordId)) ??
    (await createUser(discordId, discordName, discordAvatar));

  // A merged-away account resolves to the member who absorbed it, whose Discord
  // profile this is not. Writing it back would rename that member and replace
  // the discordRoles isAdmin reads, quietly dropping their access every time
  // the merged account signs in.
  if (user.discordId !== discordId) {
    return user;
  }

  return updateUser({ ...user, discordName, discordAvatar, discordRoles });
}
