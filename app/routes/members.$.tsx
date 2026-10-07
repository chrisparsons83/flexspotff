import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { prisma } from '~/db.server';
import {
  profileTabPath,
  requireProfileAccess,
} from '~/models/profile/access.server';

/**
 * Profiles used to live at /members/:userId. Those links are still around in
 * Discord, so send them on to /u/:handle, keeping the tab, and following a
 * merge to the member who absorbed the account.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const userId = params['*']?.split('/')[0];
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { handle: true, mergedInto: { select: { handle: true } } },
      })
    : null;

  if (!user) throw new Response('Member not found', { status: 404 });

  const handle = user.mergedInto?.handle ?? user.handle;
  throw redirect(profileTabPath(handle, new URL(request.url).pathname), 301);
};
