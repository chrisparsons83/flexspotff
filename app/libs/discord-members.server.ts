import type { User } from '@prisma/client';
import type { APIGuildMember, APIUser } from 'discord.js';
import { REST, Routes } from 'discord.js';
import { prisma } from '~/db.server';
import type { DiscordProfile } from '~/models/user.server';
import { applyDiscordProfile } from '~/models/user.server';
import { SERVER_DISCORD_ID } from '~/utils/constants';

/** Discord's cap on one page of the member list. */
const MEMBER_PAGE_SIZE = 1000;

/** Just the calls the sync makes, so tests can stand in for Discord. */
export type DiscordRestClient = Pick<REST, 'get'>;

let rest: REST | null = null;
function defaultRest() {
  if (!rest) {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN is not set');
    }
    rest = new REST({ version: '10' }).setToken(token);
  }
  return rest;
}

export function profileFromApiMember(
  member: APIGuildMember & { user: APIUser },
): DiscordProfile {
  return {
    discordId: member.user.id,
    username: member.user.username,
    globalName: member.user.global_name ?? null,
    userAvatar: member.user.avatar ?? null,
    inGuild: true,
    nick: member.nick ?? null,
    guildAvatar: member.avatar ?? null,
    roles: member.roles,
  };
}

/**
 * Every member of the server, one page at a time. Needs the Server Members
 * privileged intent enabled on the bot; without it Discord answers 403 and this
 * throws, rather than returning an empty list that would mark everyone as gone.
 */
export async function fetchGuildMembers(
  client: DiscordRestClient = defaultRest(),
  pageSize = MEMBER_PAGE_SIZE,
) {
  const members: DiscordProfile[] = [];
  let after = '0';

  for (;;) {
    const page = (await client.get(Routes.guildMembers(SERVER_DISCORD_ID), {
      query: new URLSearchParams({ limit: String(pageSize), after }),
    })) as APIGuildMember[];

    for (const member of page) {
      if (member.user && !member.user.bot) {
        members.push(profileFromApiMember({ ...member, user: member.user }));
      }
    }

    const last = page[page.length - 1]?.user?.id;
    if (page.length < pageSize || !last) {
      return members;
    }
    after = last;
  }
}

/**
 * Members the sync keeps up to date: everyone who is their own person and has a
 * real Discord account. Merged-away accounts only exist to redirect a login,
 * and placeholders made from old sheets have no Discord account to read.
 */
function syncableMembers() {
  return prisma.user.findMany({
    where: {
      mergedIntoId: null,
      NOT: { discordId: { startsWith: 'legacy:' } },
    },
  });
}

/**
 * The account-level profile of someone who is no longer in the server, so their
 * name and avatar can still follow changes to their Discord account. Null when
 * Discord will not say (the account was deleted, or the lookup failed).
 */
async function fetchDepartedProfile(
  client: DiscordRestClient,
  discordId: string,
): Promise<DiscordProfile | null> {
  try {
    const account = (await client.get(Routes.user(discordId))) as APIUser;
    return {
      discordId,
      username: account.username,
      globalName: account.global_name ?? null,
      userAvatar: account.avatar ?? null,
      inGuild: false,
    };
  } catch (error) {
    console.warn(`Could not look up Discord account ${discordId}:`, error);
    return null;
  }
}

export type MemberSyncResult = {
  checked: number;
  updated: number;
  notInServer: number;
  renamed: { userId: string; from: string; to: string }[];
};

/**
 * Brings every member's name, avatar and roles in line with the Discord server.
 *
 * Members found in the server take what the server shows. Members who are not
 * keep the last server name and avatar they had, with their account-level
 * details refreshed so an avatar they replaced does not stay broken.
 */
export async function syncMemberProfiles({
  client = defaultRest(),
  now = new Date(),
}: { client?: DiscordRestClient; now?: Date } = {}): Promise<MemberSyncResult> {
  const guildMembers = await fetchGuildMembers(client);

  // The server always has members, so an empty list means the request went
  // wrong somehow. Carrying on would mark every member as having left.
  if (guildMembers.length === 0) {
    throw new Error('Discord returned no server members; not syncing');
  }

  const byDiscordId = new Map(guildMembers.map(m => [m.discordId, m]));
  const users = await syncableMembers();
  const result: MemberSyncResult = {
    checked: users.length,
    updated: 0,
    notInServer: 0,
    renamed: [],
  };

  for (const user of users) {
    let profile: DiscordProfile | null =
      byDiscordId.get(user.discordId) ?? null;

    if (!profile) {
      result.notInServer++;
      profile = await fetchDepartedProfile(client, user.discordId);
    }

    let updated: User;
    if (profile) {
      updated = await applyDiscordProfile(user, profile, now);
    } else if (user.inGuild !== false) {
      // Not in the server and nothing else to go on: keep everything shown as
      // it is, and just note they are gone.
      updated = await prisma.user.update({
        where: { id: user.id },
        data: { inGuild: false, discordSyncedAt: now },
      });
    } else {
      updated = user;
    }

    if (updated !== user) {
      result.updated++;
    }
    if (updated.discordName !== user.discordName) {
      result.renamed.push({
        userId: user.id,
        from: user.discordName,
        to: updated.discordName,
      });
    }
  }

  return result;
}

/**
 * Applies a single member's profile as the bot sees it change. Looks the member
 * up by their own Discord ID only: a merged-away account's changes must not be
 * written over the member it was merged into.
 */
export async function syncOneMember(profile: DiscordProfile) {
  const user = await prisma.user.findUnique({
    where: { discordId: profile.discordId },
  });

  if (!user || user.mergedIntoId) {
    return null;
  }

  return applyDiscordProfile(user, profile);
}

/** Marks a member who just left the server, keeping what the site shows. */
export async function markMemberLeft(discordId: string) {
  await prisma.user.updateMany({
    where: { discordId, mergedIntoId: null },
    data: { inGuild: false, discordSyncedAt: new Date() },
  });
}
