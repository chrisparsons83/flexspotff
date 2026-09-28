import {
  defaultAvatarPath,
  resolveAvatarPath,
  resolveDisplayName,
} from './discord';
import { describe, expect, it } from 'vitest';

describe('resolveDisplayName', () => {
  it('follows what Discord shows: nickname, display name, then handle', () => {
    expect(
      resolveDisplayName({ nick: 'Nick', globalName: 'Global', username: 'u' }),
    ).toBe('Nick');
    expect(
      resolveDisplayName({ nick: null, globalName: 'Global', username: 'u' }),
    ).toBe('Global');
    expect(
      resolveDisplayName({ nick: null, globalName: null, username: 'u' }),
    ).toBe('u');
  });

  it('treats blank names as unset', () => {
    expect(
      resolveDisplayName({ nick: '  ', globalName: '', username: 'u' }),
    ).toBe('u');
    expect(resolveDisplayName({})).toBeNull();
  });
});

describe('resolveAvatarPath', () => {
  it('prefers the server avatar', () => {
    expect(
      resolveAvatarPath({ discordId: '1', guildAvatar: 'g', userAvatar: 'u' }),
    ).toBe('guilds/214093545747906562/users/1/avatars/g.webp');
    expect(resolveAvatarPath({ discordId: '1', userAvatar: 'u' })).toBe(
      'avatars/1/u.webp',
    );
    expect(resolveAvatarPath({ discordId: '1' })).toBe('');
  });
});

describe('defaultAvatarPath', () => {
  it('picks one of the six defaults from the account ID', () => {
    expect(defaultAvatarPath('214093545747906562')).toMatch(
      /^embed\/avatars\/[0-5]\.png$/,
    );
    expect(defaultAvatarPath('legacy:someone')).toBe('embed/avatars/0.png');
  });
});
