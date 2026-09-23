import { prisma } from '~/db.server';

/**
 * Every flag the site knows about. The key is what is stored; the label and
 * description are what the admin Data Updates page shows beside the toggle.
 */
export const FEATURE_FLAGS = {
  memberProfiles: {
    label: 'Member Profiles',
    description:
      'Opens /members profile pages, and the links to them from standings, ' +
      'leaderboards and records, to every signed-in member. While off, only ' +
      'admins can see them.',
  },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export const isFeatureFlagKey = (key: string): key is FeatureFlagKey =>
  Object.hasOwn(FEATURE_FLAGS, key);

/** A flag with no row has never been switched on, so it reads as off. */
export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  return flag?.enabled ?? false;
}

export async function getFeatureFlags(): Promise<
  Record<FeatureFlagKey, boolean>
> {
  const rows = await prisma.featureFlag.findMany();
  const enabled = new Set(rows.filter(row => row.enabled).map(row => row.key));

  return Object.fromEntries(
    Object.keys(FEATURE_FLAGS).map(key => [key, enabled.has(key)]),
  ) as Record<FeatureFlagKey, boolean>;
}

export async function setFeatureFlag(key: FeatureFlagKey, enabled: boolean) {
  return prisma.featureFlag.upsert({
    where: { key },
    create: { key, enabled },
    update: { enabled },
  });
}
