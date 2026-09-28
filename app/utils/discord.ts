import { SERVER_DISCORD_ID } from '~/utils/constants';

export const DISCORD_CDN = 'https://cdn.discordapp.com';

/**
 * The name Discord shows for someone in the server: their server nickname,
 * else the display name on their account, else their @username.
 *
 * Empty strings count as unset - Discord sends `""` in a few places where it
 * means "none" - so a blank nickname never blanks the name.
 */
export function resolveDisplayName(parts: {
  nick?: string | null;
  globalName?: string | null;
  username?: string | null;
}) {
  return (
    [parts.nick, parts.globalName, parts.username]
      .map(part => part?.trim())
      .find(Boolean) ?? null
  );
}

/**
 * The CDN path of the avatar Discord shows for someone in the server: their
 * server avatar, else their account avatar, else empty. Empty is left to the
 * client, which falls back to Discord's default avatar (see
 * defaultAvatarPath) rather than storing it.
 */
export function resolveAvatarPath(parts: {
  discordId: string;
  guildAvatar?: string | null;
  userAvatar?: string | null;
}) {
  if (parts.guildAvatar) {
    return guildAvatarPath(parts.discordId, parts.guildAvatar);
  }
  if (parts.userAvatar) {
    return userAvatarPath(parts.discordId, parts.userAvatar);
  }
  return '';
}

export const guildAvatarPath = (discordId: string, hash: string) =>
  `guilds/${SERVER_DISCORD_ID}/users/${discordId}/avatars/${hash}.webp`;

export const userAvatarPath = (discordId: string, hash: string) =>
  `avatars/${discordId}/${hash}.webp`;

/**
 * The generic avatar Discord shows someone who never set one. Picked the way
 * Discord picks it for accounts on the new username system - the ID shifted
 * past its timestamp, mod 6. Placeholder members made from old sheets have no
 * real ID, so they all get the first one.
 */
export function defaultAvatarPath(discordId: string) {
  let index = 0;
  if (/^\d+$/.test(discordId)) {
    index = Number((BigInt(discordId) >> BigInt(22)) % BigInt(6));
  }
  return `embed/avatars/${index}.png`;
}

/**
 * Every avatar URL worth trying for a member, best first, so an image that
 * fails to load can step down to the next instead of showing as broken. A
 * stored avatar can 404 once the member uploads a new one, until the next sync
 * picks up the new hash.
 */
export function avatarCandidates(
  user: {
    discordId: string;
    discordAvatar: string;
    discordUserAvatar?: string | null;
  },
  size = 64,
) {
  const paths = [
    user.discordAvatar,
    user.discordUserAvatar
      ? userAvatarPath(user.discordId, user.discordUserAvatar)
      : '',
  ].filter(Boolean);

  const urls = [...new Set(paths)].map(
    path => `${DISCORD_CDN}/${path}?size=${size}`,
  );
  urls.push(`${DISCORD_CDN}/${defaultAvatarPath(user.discordId)}`);
  return urls;
}
