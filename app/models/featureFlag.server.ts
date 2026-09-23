import { prisma } from '~/db.server';
import type { FeatureFlagKey } from '~/utils/featureFlags';
import { FEATURE_FLAGS } from '~/utils/featureFlags';

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
