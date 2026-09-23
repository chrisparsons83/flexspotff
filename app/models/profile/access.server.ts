import { isFeatureEnabled } from '~/models/featureFlag.server';
import type { User } from '~/models/user.server';
import { authenticator, isAdmin } from '~/services/auth.server';

/**
 * Profiles are admin-only until the memberProfiles flag is switched on from the
 * admin Data Updates page.
 */
export async function canViewProfiles(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return isFeatureEnabled('memberProfiles');
}

/**
 * The gate for every /members loader. It has to run in each tab's loader as
 * well as the parent's: Remix runs a child route's loader alongside its
 * parent's, so a check in the parent alone would still let a tab's data out.
 *
 * A member who cannot see profiles gets a 404 rather than a "no access" page,
 * so nothing hints at a feature that has not launched.
 */
export async function requireProfileAccess(request: Request): Promise<User> {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  if (!(await canViewProfiles(user))) {
    throw new Response('Not Found', { status: 404 });
  }

  return user;
}
