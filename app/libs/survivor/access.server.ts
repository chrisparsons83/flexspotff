import { authenticator } from '~/services/auth.server';

/**
 * Survivor pages are for members: anyone logged in with Discord. It has to
 * run in every loader, not just the layout's, since Remix runs a child route's
 * loader alongside its parent's.
 */
export async function requireSurvivorAccess(request: Request) {
  return authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
}
