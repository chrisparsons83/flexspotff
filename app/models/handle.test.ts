import { claimHandle, toHandleBase } from './handle.server';
import { createStubMemberForAlias } from './memberAlias.server';
import { createUser, resolveMemberForLogin } from './user.server';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '~/db.server';
import { truncateDB } from '~/utils/vitest';

const NAMES = [
  'pandabair',
  'clutch.af',
  '.dragomir',
  'listem.',
  'greg_irl',
  'Big Chris 🏈',
  'Bootz - 💩',
  'Smash, Criosphinx Sovereign',
  'Allen #DOLPHINSSUPERBOWL1973',
  'tylerj03#0012',
  '. Jeremy',
  'ListEm™',
  'Zoë  --  Two',
  '🏈🏈',
];

describe('toHandleBase', () => {
  it.each([
    ['pandabair', 'pandabair'],
    ['clutch.af', 'clutch.af'],
    ['greg_irl', 'greg_irl'],
    ['.dragomir', 'dragomir'],
    ['Big Chris 🏈', 'big-chris'],
    ['Bootz - 💩', 'bootz'],
    ['Smash, Criosphinx Sovereign', 'smash-criosphinx-sovereign'],
    ['🏈🏈', 'member'],
  ])('%s -> %s', (name, handle) => {
    expect(toHandleBase(name)).toBe(handle);
  });

  // The migration backfilled every existing member with the same steps in SQL.
  // A member created now must get the handle the backfill would have given them.
  it('matches the backfill in the add_user_handle migration', async () => {
    for (const name of NAMES) {
      const [row] = await prisma.$queryRaw<{ base: string }[]>`
        SELECT regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(lower(${name}), '[\\s-]+', '-', 'g'),
              '[^a-z0-9_.-]', '', 'g'),
            '-+', '-', 'g'),
          '^[-.]+|[-.]+$', '', 'g') AS base`;

      expect(toHandleBase(name), name).toBe(row.base || 'member');
    }
  });
});

describe('claimHandle', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  it('prefers the Discord @username over the server name', async () => {
    expect(
      await claimHandle({ username: 'pandabair', displayName: 'Panda 🐼' }),
    ).toBe('pandabair');
    expect(await claimHandle({ username: null, displayName: 'Panda 🐼' })).toBe(
      'panda',
    );
  });

  it('adds a number when the handle is taken', async () => {
    await createUser('discord-1', 'Panda', '');
    await createUser('discord-2', 'Panda', '');
    await createUser('discord-3', 'Panda', '');

    const handles = await prisma.user.findMany({
      orderBy: { handle: 'asc' },
      select: { handle: true },
    });
    expect(handles.map(user => user.handle)).toEqual([
      'panda',
      'panda-2',
      'panda-3',
    ]);
  });

  it('is not thrown off by a longer handle that starts the same way', async () => {
    await createUser('discord-1', 'Pandabair', '');

    expect(await claimHandle({ displayName: 'Panda' })).toBe('panda');
  });
});

describe('a member’s handle', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  it('comes from their @username on first login and survives renames', async () => {
    const profile = {
      discordId: 'discord-a',
      username: 'pandabair',
      globalName: 'Panda',
      userAvatar: null,
      inGuild: true as const,
      nick: 'Panda 🐼',
      guildAvatar: null,
      roles: [],
    };

    const created = await resolveMemberForLogin(profile);
    expect(created.handle).toBe('pandabair');

    const renamed = await resolveMemberForLogin({
      ...profile,
      username: 'bigpanda',
      nick: 'Big Panda',
    });
    expect(renamed.discordName).toBe('Big Panda');
    expect(renamed.handle).toBe('pandabair');
  });
});

describe('provisional handles', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  const loginAs = (username: string, nick: string, discordId = 'discord-a') =>
    resolveMemberForLogin({
      discordId,
      username,
      globalName: null,
      userAvatar: null,
      inGuild: true,
      nick,
      guildAvatar: null,
      roles: [],
    });

  it('switch to the @username the first time Discord reports one, then lock', async () => {
    // Added by an admin before they ever logged in: no @username yet.
    await createUser('discord-a', 'Big Mike', '');

    const first = await loginAs('mikeb', 'Big Mike');
    expect(first.handle).toBe('mikeb');

    const renamed = await loginAs('mikeb2', 'Mike');
    expect(renamed.handle).toBe('mikeb');
  });

  it('take the name from a sheet placeholder, which moves aside', async () => {
    await createStubMemberForAlias('Chris');

    const member = await loginAs('chris', 'Chris');

    expect(member.handle).toBe('chris');
    const stub = await prisma.user.findUnique({
      where: { discordId: 'legacy:chris' },
    });
    expect(stub?.handle).toBe('chris-2');
  });

  it('never bump a real member, even one who has left the server', async () => {
    await createUser('discord-gone', 'Chris', '');

    const member = await loginAs('chris', 'Chris');

    expect(member.handle).toBe('chris-2');
    const gone = await prisma.user.findUnique({
      where: { discordId: 'discord-gone' },
    });
    expect(gone?.handle).toBe('chris');
  });

  it('settle two members with the same name signing up at once', async () => {
    const [a, b] = await Promise.all([
      createUser('discord-1', 'Panda', ''),
      createUser('discord-2', 'Panda', ''),
    ]);

    expect([a.handle, b.handle].sort()).toEqual(['panda', 'panda-2']);
  });

  it('do not look up a handle again for a placeholder that already exists', async () => {
    const first = await createStubMemberForAlias('Chris');
    const again = await createStubMemberForAlias('Chris');

    expect(again).toBe(first);
  });
});
