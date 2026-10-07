import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import ProfileHero from '~/components/layout/profile/ProfileHero';
import ProfileTabs from '~/components/layout/profile/ProfileTabs';
import { requireProfileMember } from '~/models/profile/access.server';
import { getProfileSummary } from '~/models/profile/summary.server';

/**
 * A member's profile. The hero and tab bar live here; each tab is a child route
 * with its own loader, so opening a profile only queries the contest being
 * looked at.
 *
 * Profiles are members-only.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireProfileMember(request, params.handle);

  const summary = await getProfileSummary(userId);
  if (!summary) throw new Response('Member not found', { status: 404 });

  return typedjson({ summary });
};

export default function MemberProfile() {
  const { summary } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <ProfileHero
        summary={summary}
        tabs={
          <ProfileTabs
            handle={summary.user.handle}
            contestsPlayed={summary.contestsPlayed}
          />
        }
      />
      <div className='mt-6'>
        <Outlet context={summary} />
      </div>
    </>
  );
}
