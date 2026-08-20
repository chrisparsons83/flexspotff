import {
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

  const login = (discordId: string, overrides = {}) =>
    resolveMemberForLogin({
      discordId,
      discordName: 'New Nick',
      discordAvatar: 'new-avatar',
      discordRoles: ['role-member'],
      ...overrides,
    });

  it('refreshes the profile of the member who actually signed in', async () => {
    await prisma.user.create({
      data: {
        discordId: 'discord-a',
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
          discordName: 'Panda',
          discordAvatar: '',
          discordRoles: [],
        },
      }),
      prisma.user.create({
        data: {
          discordId: 'discord-main',
          discordName: 'pandabair',
          discordAvatar: 'main-avatar',
          discordRoles: ['role-admin'],
        },
      }),
      prisma.user.create({
        data: {
          discordId: 'discord-admin',
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
