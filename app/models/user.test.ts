import type { DiscordProfile } from './user.server';
import {
  applyDiscordProfile,
  getUserByDiscordId,
  getUsers,
  getUsersIncludingMerged,
  resolveMemberForLogin,
} from './user.server';
import { mergeUsers } from './userMerge.server';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '~/db.server';
import { truncateDB } from '~/utils/vitest';

const makeUser = (name: string) =>
  prisma.user.create({
    data: {
      discordId: `discord-${name}`,
      handle: `discord-${name}`,
      discordName: name,
      discordAvatar: '',
    },
  });

describe('getUserByDiscordId', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  it('returns the member themselves when they have not been merged', async () => {
    const user = await makeUser('Panda');

    expect((await getUserByDiscordId('discord-Panda'))?.id).toBe(user.id);
  });

  it('resolves a merged-away account to the member it was merged into', async () => {
    const [dup, canon, admin] = await Promise.all([
      makeUser('Panda'),
      makeUser('pandabair'),
      makeUser('Admin'),
    ]);
    await mergeUsers(dup.id, canon.id, admin.id);

    // This is what stops a re-login from recreating the split.
    const resolved = await getUserByDiscordId('discord-Panda');

    expect(resolved?.id).toBe(canon.id);
    expect(resolved?.discordName).toBe('pandabair');
  });

  it('returns null for an account nobody has', async () => {
    expect(await getUserByDiscordId('nobody')).toBeNull();
  });

  it('reports the merged account so the caller can decline to write to it', async () => {
    const [dup, canon, admin] = await Promise.all([
      makeUser('Panda'),
      makeUser('pandabair'),
      makeUser('Admin'),
    ]);
    await mergeUsers(dup.id, canon.id, admin.id);

    // The Discord callback compares this against the profile that logged in to
    // decide whether the profile belongs to the member it resolved to. If the
    // resolved row carried the tombstone's discordId, the callback would write
    // the merged account's name and roles onto the canonical member.
    const resolved = await getUserByDiscordId('discord-Panda');

    expect(resolved?.discordId).toBe('discord-pandabair');
  });
});

describe('member listings', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  it('leaves merged members out of the pickers but keeps them for admins', async () => {
    const [dup, canon, admin] = await Promise.all([
      makeUser('Panda'),
      makeUser('pandabair'),
      makeUser('Admin'),
    ]);
    await mergeUsers(dup.id, canon.id, admin.id);

    const live = await getUsers();
    expect(live.map(u => u.discordName).sort()).toEqual(['Admin', 'pandabair']);

    const all = await getUsersIncludingMerged();
    expect(all.map(u => u.discordName).sort()).toEqual([
      'Admin',
      'Panda',
      'pandabair',
    ]);
    expect(
      all.find(u => u.discordName === 'Panda')?.mergedInto?.discordName,
    ).toBe('pandabair');
  });
});

describe('resolveMemberForLogin', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  const login = (discordId: string) =>
    resolveMemberForLogin({
      discordId,
      username: 'handle',
      globalName: 'Display',
      userAvatar: 'user-hash',
      inGuild: true,
      nick: 'New Nick',
      guildAvatar: 'new-avatar',
      roles: ['role-member'],
    });

  it('refreshes the profile of the member who actually signed in', async () => {
    await prisma.user.create({
      data: {
        discordId: 'discord-a',
        handle: 'discord-a',
        discordName: 'Old Nick',
        discordAvatar: 'old-avatar',
        discordRoles: ['role-admin'],
      },
    });

    const resolved = await login('discord-a');

    expect(resolved.discordName).toBe('New Nick');
    expect(resolved.discordRoles).toEqual(['role-member']);
  });

  it('creates a member the first time they sign in', async () => {
    const resolved = await login('discord-new');

    expect(resolved.discordId).toBe('discord-new');
    expect(resolved.discordName).toBe('New Nick');
  });

  it('never overwrites the canonical member from a merged account login', async () => {
    const [dup, canon, admin] = await Promise.all([
      prisma.user.create({
        data: {
          discordId: 'discord-alt',
          handle: 'discord-alt',
          discordName: 'Panda',
          discordAvatar: '',
          discordRoles: [],
        },
      }),
      prisma.user.create({
        data: {
          discordId: 'discord-main',
          handle: 'discord-main',
          discordName: 'pandabair',
          discordAvatar: 'main-avatar',
          discordRoles: ['role-admin'],
        },
      }),
      prisma.user.create({
        data: {
          discordId: 'discord-admin',
          handle: 'discord-admin',
          discordName: 'A',
          discordAvatar: '',
        },
      }),
    ]);
    await mergeUsers(dup.id, canon.id, admin.id);

    // Signing in with the merged-away account resolves to the canonical member,
    // but must not rewrite them: discordRoles is what isAdmin reads, so doing so
    // would drop their admin access on every login through the alt.
    const resolved = await login('discord-alt');

    expect(resolved.id).toBe(canon.id);
    expect(resolved.discordName).toBe('pandabair');
    expect(resolved.discordRoles).toEqual(['role-admin']);

    const stored = await prisma.user.findUnique({ where: { id: canon.id } });
    expect(stored?.discordName).toBe('pandabair');
    expect(stored?.discordRoles).toEqual(['role-admin']);
    expect(stored?.discordAvatar).toBe('main-avatar');
  });
});

describe('applyDiscordProfile', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  const inServer = (
    overrides: Partial<Extract<DiscordProfile, { inGuild: true }>> = {},
  ): DiscordProfile => ({
    discordId: 'discord-a',
    username: 'pandabair',
    globalName: 'Panda Bair',
    userAvatar: 'user-hash',
    inGuild: true,
    nick: null,
    guildAvatar: null,
    roles: ['role-member'],
    ...overrides,
  });

  const member = () =>
    prisma.user.create({
      data: {
        discordId: 'discord-a',
        handle: 'discord-a',
        discordName: 'pandabair',
        discordAvatar: '',
        createdAt: new Date('2020-01-01'),
      },
    });

  it('shows the server nickname over the display name and handle', async () => {
    const user = await member();

    const updated = await applyDiscordProfile(
      user,
      inServer({ nick: 'Panda' }),
    );

    expect(updated.discordName).toBe('Panda');
    expect(updated.discordUsername).toBe('pandabair');
    expect(updated.inGuild).toBe(true);
  });

  it('shows the display name, not the handle, when there is no nickname', async () => {
    const user = await member();

    const updated = await applyDiscordProfile(user, inServer());

    expect(updated.discordName).toBe('Panda Bair');
  });

  it('prefers the server avatar, falling back to the account avatar', async () => {
    const user = await member();

    const withServerAvatar = await applyDiscordProfile(
      user,
      inServer({ guildAvatar: 'guild-hash' }),
    );
    expect(withServerAvatar.discordAvatar).toBe(
      'guilds/214093545747906562/users/discord-a/avatars/guild-hash.webp',
    );

    const without = await applyDiscordProfile(withServerAvatar, inServer());
    expect(without.discordAvatar).toBe('avatars/discord-a/user-hash.webp');
  });

  it('records each name the member goes by', async () => {
    const user = await member();

    const first = await applyDiscordProfile(
      user,
      inServer({ nick: 'Panda' }),
      new Date('2026-01-01'),
    );
    await applyDiscordProfile(
      first,
      inServer({ nick: 'Bamboo Eater' }),
      new Date('2026-02-01'),
    );

    const past = await prisma.userNameHistory.findMany({
      where: { userId: user.id, name: { not: 'Bamboo Eater' } },
      orderBy: { lastSeenAt: 'desc' },
    });
    expect(past.map(p => p.name)).toEqual(['Panda', 'pandabair']);

    // The name they had before history began is backfilled from when they
    // joined.
    const original = await prisma.userNameHistory.findFirst({
      where: { userId: user.id, name: 'pandabair' },
    });
    expect(original?.firstSeenAt).toEqual(new Date('2020-01-01'));
  });

  it('does not write when nothing changed', async () => {
    const user = await member();
    const synced = await applyDiscordProfile(user, inServer());

    const again = await applyDiscordProfile(synced, inServer());

    expect(again).toBe(synced);
  });

  it('keeps the last server name, avatar and roles once they leave', async () => {
    const user = await member();
    const synced = await applyDiscordProfile(
      user,
      inServer({ nick: 'Panda', guildAvatar: 'guild-hash', roles: ['admin'] }),
    );

    const left = await applyDiscordProfile(synced, {
      discordId: 'discord-a',
      username: 'pandabair',
      globalName: 'Panda Bair',
      userAvatar: 'new-user-hash',
      inGuild: false,
    });

    expect(left.inGuild).toBe(false);
    expect(left.discordName).toBe('Panda');
    expect(left.discordAvatar).toContain('guild-hash');
    expect(left.discordUserAvatar).toBe('new-user-hash');
    // Not confirmed gone (a failed login lookup, say): roles stay.
    expect(left.discordRoles).toEqual(['admin']);

    const gone = await applyDiscordProfile(left, {
      discordId: 'discord-a',
      username: 'pandabair',
      globalName: 'Panda Bair',
      userAvatar: 'new-user-hash',
      inGuild: false,
      confirmedGone: true,
    });
    expect(gone.discordRoles).toEqual([]);
    expect(gone.discordName).toBe('Panda');
  });

  it('refuses a profile that belongs to another account', async () => {
    const user = await member();

    await expect(
      applyDiscordProfile(user, inServer({ discordId: 'discord-b' })),
    ).rejects.toThrow();
  });
});
