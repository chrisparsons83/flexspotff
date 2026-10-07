import { redirect } from '@remix-run/node';
import { prisma } from '~/db.server';
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

/**
 * The gate for /u/:handle and each of its tabs: checks the reader may see
 * profiles, then finds whose profile the handle is. Returns that member's id.
 *
 * It runs in every tab's loader, not just the parent's, so a link that needs
 * sending elsewhere is redirected before any tab queries its contest:
 * - a merged-away handle goes to the member who absorbed the account. The
 *   tombstone keeps its handle so old links still land somewhere.
 * - a handle typed with capitals goes to the lowercase one it is stored as.
 */
export async function requireProfileMember(
  request: Request,
  handle: string | undefined,
): Promise<string> {
  await requireProfileAccess(request);

  const stored = handle?.toLowerCase();
  const user = stored
    ? await prisma.user.findUnique({
        where: { handle: stored },
        select: { id: true, mergedInto: { select: { handle: true } } },
      })
    : null;
  if (!user || !stored) throw new Response('Member not found', { status: 404 });

  const { pathname } = new URL(request.url);
  if (user.mergedInto) {
    throw redirect(profileTabPath(user.mergedInto.handle, pathname), 301);
  }
  if (stored !== handle) {
    throw redirect(profileTabPath(stored, pathname), 301);
  }

  return user.id;
}

/**
 * Every live member's handle by id, for links built from data that only carries
 * a user id - records, standings, opponents. Sent from the root loader, so a
 * page can link anyone without each query having to select their handle.
 */
export async function getProfileHandles(): Promise<Record<string, string>> {
  const users = await prisma.user.findMany({
    where: { mergedIntoId: null },
    select: { id: true, handle: true },
  });

  return Object.fromEntries(users.map(user => [user.id, user.handle]));
}

/**
 * The same profile tab under another member's handle: /u/old/cup or
 * /members/:id/cup becomes /u/:handle/cup. Used to redirect old and merged-away
 * links without losing which tab they pointed at.
 */
export function profileTabPath(handle: string, fromPathname: string) {
  // ['', 'u' | 'members', ':key', ...tab]
  const tab = fromPathname.split('/').slice(3).join('/');
  return `/u/${handle}${tab ? `/${tab}` : ''}`;
}
