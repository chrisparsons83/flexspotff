import type { DiscordRestClient } from './discord-members.server';
import {
  fetchGuildMembers,
  markMemberLeft,
  syncMemberProfiles,
  syncOneMember,
} from './discord-members.server';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '~/db.server';
import { mergeUsers } from '~/models/userMerge.server';
import { truncateDB } from '~/utils/vitest';

type FakeMember = {
  id: string;
  username: string;
  globalName?: string | null;
  nick?: string | null;
  avatar?: string | null;
  guildAvatar?: string | null;
  roles?: string[];
  bot?: boolean;
};

/**
 * Stands in for Discord: serves the member list in pages of `pageSize` and
 * account lookups for anyone in `accounts`.
 */
function fakeDiscord({
  members,
  accounts = [],
}: {
  members: FakeMember[];
  accounts?: FakeMember[];
}) {
  const calls: string[] = [];
  const toUser = (m: FakeMember) => ({
    id: m.id,
    username: m.username,
    global_name: m.globalName ?? null,
    avatar: m.avatar ?? null,
    bot: m.bot,
  });

  const client: DiscordRestClient = {
    get: async (route: string, options?: { query?: URLSearchParams }) => {
      calls.push(route);
      if (route.endsWith('/members')) {
        const after = options?.query?.get('after') ?? '0';
        const limit = Number(options?.query?.get('limit'));
        const start = members.findIndex(m => BigInt(m.id) > BigInt(after));
        const page = start === -1 ? [] : members.slice(start, start + limit);
        return page.map(m => ({
          user: toUser(m),
          nick: m.nick ?? null,
          avatar: m.guildAvatar ?? null,
          roles: m.roles ?? [],
        }));
      }
      const account = accounts.find(a => route === `/users/${a.id}`);
      if (!account) {
        throw new Error('Unknown User');
      }
      return toUser(account);
    },
  } as DiscordRestClient;

  return { client, calls };
}

const makeUser = (discordId: string, discordName: string, extra = {}) =>
  prisma.user.create({
    data: { discordId, discordName, discordAvatar: '', ...extra },
  });

describe('syncMemberProfiles', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  it('gives every member the name and avatar the server shows', async () => {
    await makeUser('101', 'old_handle');
    await makeUser('102', 'Old Nick');
    const { client } = fakeDiscord({
      members: [
        { id: '101', username: 'handle', globalName: 'Display Name' },
        {
          id: '102',
          username: 'other',
          nick: 'New Nick',
          guildAvatar: 'g1',
          roles: ['r1'],
        },
      ],
    });

    const result = await syncMemberProfiles({ client });

    const users = await prisma.user.findMany({ orderBy: { discordId: 'asc' } });
    expect(users.map(u => u.discordName)).toEqual(['Display Name', 'New Nick']);
    expect(users[1].discordAvatar).toContain('/avatars/g1.webp');
    expect(users[1].discordRoles).toEqual(['r1']);
    expect(result.updated).toBe(2);
    expect(result.renamed).toHaveLength(2);
  });

  it('keeps the last known name for members who left the server', async () => {
    await makeUser('101', 'Here');
    await makeUser('104', 'Gone But Remembered', {
      discordNick: 'Gone But Remembered',
      discordGuildAvatar: 'old-guild',
      discordRoles: ['admin'],
      inGuild: true,
    });
    const { client } = fakeDiscord({
      members: [{ id: '101', username: 'here', nick: 'Here' }],
      accounts: [{ id: '104', username: 'gone', avatar: 'new-account-avatar' }],
    });

    const result = await syncMemberProfiles({ client });

    const gone = await prisma.user.findUnique({ where: { discordId: '104' } });
    expect(gone?.inGuild).toBe(false);
    expect(gone?.discordName).toBe('Gone But Remembered');
    expect(gone?.discordRoles).toEqual(['admin']);
    expect(gone?.discordUserAvatar).toBe('new-account-avatar');
    expect(result.notInServer).toBe(1);
  });

  it('marks a departed member whose account cannot be looked up', async () => {
    await makeUser('101', 'Here');
    await makeUser('105', 'Deleted Account');
    const { client } = fakeDiscord({
      members: [{ id: '101', username: 'here', nick: 'Here' }],
    });

    await syncMemberProfiles({ client });

    const deleted = await prisma.user.findUnique({
      where: { discordId: '105' },
    });
    expect(deleted?.inGuild).toBe(false);
    expect(deleted?.discordName).toBe('Deleted Account');
  });

  it('leaves placeholders and merged-away accounts alone', async () => {
    const stub = await makeUser('legacy:someone', 'Someone From A Sheet');
    const [alt, main, admin] = await Promise.all([
      makeUser('201', 'Alt'),
      makeUser('202', 'Main'),
      makeUser('203', 'Admin'),
    ]);
    await mergeUsers(alt.id, main.id, admin.id);
    const { client, calls } = fakeDiscord({
      members: [
        { id: '201', username: 'alt', nick: 'Should Not Apply' },
        { id: '202', username: 'main', nick: 'Main Nick' },
        { id: '203', username: 'admin' },
      ],
    });

    await syncMemberProfiles({ client });

    const after = await prisma.user.findMany();
    const byId = new Map(after.map(u => [u.id, u]));
    expect(byId.get(stub.id)?.discordName).toBe('Someone From A Sheet');
    expect(byId.get(alt.id)?.discordName).toBe('Alt');
    expect(byId.get(main.id)?.discordName).toBe('Main Nick');
    // No lookups for the placeholder.
    expect(calls.some(c => c.includes('legacy'))).toBe(false);
  });

  it('refuses to run on an empty member list', async () => {
    await makeUser('101', 'Here');
    const { client } = fakeDiscord({ members: [] });

    await expect(syncMemberProfiles({ client })).rejects.toThrow();

    const user = await prisma.user.findUnique({ where: { discordId: '101' } });
    expect(user?.inGuild).toBeNull();
  });

  it('skips bots', async () => {
    await makeUser('101', 'Here');
    const { client } = fakeDiscord({
      members: [
        { id: '101', username: 'here' },
        { id: '999', username: 'flexbot', bot: true },
      ],
    });

    const result = await syncMemberProfiles({ client });

    expect(result.checked).toBe(1);
  });
});

describe('fetchGuildMembers', () => {
  it('reads every page of a large server', async () => {
    const { client, calls } = fakeDiscord({
      members: ['101', '102', '103', '104', '105'].map(id => ({
        id,
        username: `user${id}`,
      })),
    });

    const members = await fetchGuildMembers(client, 2);

    expect(members.map(m => m.discordId)).toEqual([
      '101',
      '102',
      '103',
      '104',
      '105',
    ]);
    // Two full pages, then a short one that ends it.
    expect(calls).toHaveLength(3);
  });
});

describe('syncOneMember', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  const profile = (discordId: string) => ({
    discordId,
    username: 'handle',
    globalName: null,
    userAvatar: null,
    inGuild: true as const,
    nick: 'Live Nick',
    guildAvatar: null,
    roles: [],
  });

  it('applies a change the bot sees', async () => {
    await makeUser('101', 'Old');

    const updated = await syncOneMember(profile('101'));

    expect(updated?.discordName).toBe('Live Nick');
  });

  it('ignores accounts that were merged away or never joined the site', async () => {
    const [alt, main, admin] = await Promise.all([
      makeUser('201', 'Alt'),
      makeUser('202', 'Main'),
      makeUser('203', 'Admin'),
    ]);
    await mergeUsers(alt.id, main.id, admin.id);

    expect(await syncOneMember(profile('201'))).toBeNull();
    expect(await syncOneMember(profile('999'))).toBeNull();

    const stored = await prisma.user.findUnique({ where: { id: main.id } });
    expect(stored?.discordName).toBe('Main');
  });

  it('marks a member who left', async () => {
    await makeUser('101', 'Leaving');

    await markMemberLeft('101');

    const stored = await prisma.user.findUnique({
      where: { discordId: '101' },
    });
    expect(stored?.inGuild).toBe(false);
    expect(stored?.discordName).toBe('Leaving');
  });
});
