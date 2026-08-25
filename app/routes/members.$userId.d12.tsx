import type { LoaderFunctionArgs } from '@remix-run/node';
import { useOutletContext } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import ContestTab from '~/components/layout/profile/ContestTab';
import { getD12Profile } from '~/models/profile/sideGames.server';
import type { ProfileSummary } from '~/models/profile/summary.server';
import { authenticator } from '~/services/auth.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, { failureRedirect: '/login' });

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getD12Profile(userId) });
};

export default function MemberContest() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  return (
    <ContestTab
      profile={profile}
      memberName={summary.user.discordName}
      contestLabel='D12'
      seasonColumnLabel='Weeks'
    />
  );
}
