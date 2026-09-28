import type { User } from '@prisma/client';
import { prisma } from '~/db.server';
import { resolveAvatarPath, resolveDisplayName } from '~/utils/discord';

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
      nameHistory: { create: { name: discordName } },
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
      nameHistory: { select: { name: true } },
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
 * What Discord reports about a member, from a login or from the bot.
 *
 * `inGuild` false means they are not in the server right now, so there is no
 * nickname or server avatar to read. Those keep their last known values, so the
 * site goes on showing the name people last knew them by.
 *
 * Roles are cleared only when `confirmedGone` says Discord's own member list
 * shows them gone - someone kicked or banned must lose admin access. A login
 * whose member lookup merely failed keeps them, so a Discord hiccup cannot
 * quietly strip an admin.
 */
export type DiscordProfile = {
  discordId: string;
  username: string | null;
  globalName: string | null;
  userAvatar: string | null;
} & (
  | {
      inGuild: true;
      nick: string | null;
      guildAvatar: string | null;
      roles: string[];
    }
  | { inGuild: false; confirmedGone?: boolean }
);

/** The User columns a Discord profile sets. */
export function discordProfileFields(
  user: Pick<
    User,
    | 'discordId'
    | 'discordName'
    | 'discordRoles'
    | 'discordNick'
    | 'discordGuildAvatar'
  >,
  profile: DiscordProfile,
) {
  const nick = profile.inGuild ? profile.nick : user.discordNick;
  const guildAvatar = profile.inGuild
    ? profile.guildAvatar
    : user.discordGuildAvatar;

  return {
    discordName:
      resolveDisplayName({
        nick,
        globalName: profile.globalName,
        username: profile.username,
      }) ?? user.discordName,
    discordAvatar: resolveAvatarPath({
      discordId: user.discordId,
      guildAvatar,
      userAvatar: profile.userAvatar,
    }),
    discordRoles: profile.inGuild
      ? profile.roles
      : profile.confirmedGone
      ? []
      : user.discordRoles,
    discordUsername: profile.username,
    discordGlobalName: profile.globalName,
    discordNick: nick,
    discordUserAvatar: profile.userAvatar,
    discordGuildAvatar: guildAvatar,
    inGuild: profile.inGuild,
  };
}

const sameValue = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((value, i) => value === b[i])
    : a === b;

/**
 * Writes a Discord profile onto the member it belongs to, and records a new
 * display name in their name history.
 *
 * Does nothing (and returns the member as it was) when nothing Discord reports
 * has changed, so the hourly sync only writes the handful of members who
 * actually changed something.
 *
 * The caller has to have checked the profile belongs to this member: a merged
 * member signing in with the account that was merged away must never have that
 * account's name and roles written over theirs.
 */
export async function applyDiscordProfile(
  user: User,
  profile: DiscordProfile,
  now = new Date(),
) {
  if (user.discordId !== profile.discordId) {
    throw new Error(
      `Discord profile ${profile.discordId} does not belong to member ${user.id}`,
    );
  }

  const fields = discordProfileFields(user, profile);
  const changed = (Object.keys(fields) as (keyof typeof fields)[]).some(
    key => !sameValue(fields[key], user[key]),
  );

  if (!changed) {
    return user;
  }

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { ...fields, discordSyncedAt: now },
    }),
    ...(fields.discordName !== user.discordName
      ? [
          // The old name was last seen now. It may predate name history, so
          // backfill it from when the member joined.
          prisma.userNameHistory.upsert({
            where: { userId_name: { userId: user.id, name: user.discordName } },
            create: {
              userId: user.id,
              name: user.discordName,
              firstSeenAt: user.createdAt,
              lastSeenAt: now,
            },
            update: { lastSeenAt: now },
          }),
          prisma.userNameHistory.upsert({
            where: {
              userId_name: { userId: user.id, name: fields.discordName },
            },
            create: {
              userId: user.id,
              name: fields.discordName,
              firstSeenAt: now,
              lastSeenAt: now,
            },
            update: { lastSeenAt: now },
          }),
        ]
      : []),
  ]);

  return updated;
}

/**
 * The names a member went by before their current one, most recent first. Used
 * to say who someone was, since nicknames on the server change often.
 */
export async function getPastNames(userId: User['id'], currentName: string) {
  const rows = await prisma.userNameHistory.findMany({
    where: { userId, name: { not: currentName } },
    orderBy: { lastSeenAt: 'desc' },
    select: { name: true, lastSeenAt: true },
  });
  return rows;
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
export async function resolveMemberForLogin(profile: DiscordProfile) {
  const initialName =
    resolveDisplayName({
      nick: profile.inGuild ? profile.nick : null,
      globalName: profile.globalName,
      username: profile.username,
    }) ?? profile.discordId;

  const user =
    (await getUserByDiscordId(profile.discordId)) ??
    (await createUser(profile.discordId, initialName, ''));

  // A merged-away account resolves to the member who absorbed it, whose Discord
  // profile this is not. Writing it back would rename that member and replace
  // the discordRoles isAdmin reads, quietly dropping their access every time
  // the merged account signs in.
  if (user.discordId !== profile.discordId) {
    return user;
  }

  return applyDiscordProfile(user, profile);
}
