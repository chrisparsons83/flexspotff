import {
  getUserByDiscordId,
  getUsers,
  getUsersIncludingMerged,
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
