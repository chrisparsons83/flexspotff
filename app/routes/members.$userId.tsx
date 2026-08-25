import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import ProfileHero from '~/components/layout/profile/ProfileHero';
import ProfileTabs from '~/components/layout/profile/ProfileTabs';
import { prisma } from '~/db.server';
import { getProfileSummary } from '~/models/profile/summary.server';
import { authenticator } from '~/services/auth.server';

/**
 * A member's profile. The hero and tab bar live here; each tab is a child route
 * with its own loader, so opening a profile only queries the contest being
 * looked at.
 *
 * Profiles are members-only.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  // A merged-away account is a tombstone kept so its Discord id stays claimed.
  // Its history now belongs to whoever absorbed it, so send the reader there
  // rather than rendering an empty profile.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, mergedIntoId: true },
  });

  if (!user) throw new Response('Member not found', { status: 404 });

  if (user.mergedIntoId) {
    // /members/:userId/:tab -> ['', 'members', ':userId', ':tab'], so the tab
    // and anything below it starts at index 3.
    const { pathname } = new URL(request.url);
    const tab = pathname.split('/').slice(3).join('/');
    throw redirect(`/members/${user.mergedIntoId}${tab ? `/${tab}` : ''}`, 301);
  }

  const summary = await getProfileSummary(userId);
  if (!summary) throw new Response('Member not found', { status: 404 });

  return typedjson({ summary });
};

export default function MemberProfile() {
  const { summary } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <ProfileHero summary={summary} />
      <ProfileTabs
        userId={summary.user.id}
        contestsPlayed={summary.contestsPlayed}
      />
      <div className='mt-6'>
        <Outlet context={summary} />
      </div>
    </>
  );
}
