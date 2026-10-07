import { loadSessionMember, profileFromLogin } from './auth.server';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '~/db.server';
import { mergeUsers } from '~/models/userMerge.server';
import { truncateDB } from '~/utils/vitest';

describe('profileFromLogin', () => {
  const account = {
    id: '101',
    username: 'pandabair',
    global_name: 'Panda Bair',
    avatar: 'user-hash',
  };

  it('reads the display name, not just the handle', () => {
    const profile = profileFromLogin(account, {
      ok: true,
      json: { nick: null, avatar: 'guild-hash', roles: ['r1'] },
    });

    expect(profile).toEqual({
      discordId: '101',
      username: 'pandabair',
      globalName: 'Panda Bair',
      userAvatar: 'user-hash',
      inGuild: true,
      nick: null,
      guildAvatar: 'guild-hash',
      roles: ['r1'],
    });
  });

  it('reports someone who is not in the server', () => {
    const profile = profileFromLogin(account, {
      ok: false,
      json: {},
    });

    expect(profile.inGuild).toBe(false);
  });
});

describe('loadSessionMember', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  const makeUser = (discordId: string, discordName: string) =>
    prisma.user.create({
      data: { discordId, handle: discordId, discordName, discordAvatar: '' },
    });

  it('returns the member as they are now, not as the cookie remembers', async () => {
    const user = await makeUser('101', 'Old Nick');
    await prisma.user.update({
      where: { id: user.id },
      data: { discordName: 'New Nick', discordRoles: ['admin'] },
    });

    const loaded = await loadSessionMember({ id: user.id });

    expect(loaded?.discordName).toBe('New Nick');
    expect(loaded?.discordRoles).toEqual(['admin']);
  });

  it('follows a merge made since they logged in', async () => {
    const [alt, main, admin] = await Promise.all([
      makeUser('201', 'Alt'),
      makeUser('202', 'Main'),
      makeUser('203', 'Admin'),
    ]);
    await mergeUsers(alt.id, main.id, admin.id);

    expect((await loadSessionMember({ id: alt.id }))?.id).toBe(main.id);
  });

  it('has nobody for a deleted member', async () => {
    expect(await loadSessionMember({ id: 'gone' })).toBeNull();
  });
});
