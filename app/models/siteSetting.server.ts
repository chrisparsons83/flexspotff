import { prisma } from '~/db.server';

export type { SiteSetting } from '@prisma/client';

/**
 * Every setting the admin settings page can edit. A key has to be listed here
 * before anything can read or write it, so a typo is a type error rather than a
 * setting that silently never takes effect.
 */
export const SITE_SETTINGS = {
  adminAlertsChannelId: {
    label: 'Admin Alerts Channel ID',
    description:
      'The Discord channel scheduled jobs post admin alerts to, such as QB Streaming weeks opening and changing. Leave empty to post nothing.',
    kind: 'discordId',
  },
} as const;

export type SiteSettingKey = keyof typeof SITE_SETTINGS;

export const SITE_SETTING_KEYS = Object.keys(SITE_SETTINGS) as SiteSettingKey[];

export const isSiteSettingKey = (key: unknown): key is SiteSettingKey =>
  typeof key === 'string' && key in SITE_SETTINGS;

/** A Discord channel, role or user ID: a snowflake, 17 to 20 digits. */
export const isDiscordId = (value: string) => /^\d{17,20}$/.test(value);

/** The setting's value, or null when nobody has set it. */
export async function getSetting(key: SiteSettingKey) {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Every setting that has a value, with who last changed it. */
export async function getSettings() {
  return prisma.siteSetting.findMany({
    where: { key: { in: SITE_SETTING_KEYS } },
    include: {
      updatedBy: { select: { discordName: true } },
    },
  });
}

/**
 * Saves a setting. An empty value clears it, so "not set" is always a missing
 * row rather than sometimes an empty string.
 */
export async function setSetting(
  key: SiteSettingKey,
  value: string,
  updatedById: string,
) {
  const trimmed = value.trim();
  if (!trimmed) {
    await prisma.siteSetting.deleteMany({ where: { key } });
    return null;
  }

  return prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: trimmed, updatedById },
    update: { value: trimmed, updatedById },
  });
}
