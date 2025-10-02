import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import {
  authenticator,
  isAdmin,
  isPodcastEditor,
  requireEditor,
} from '~/services/auth.server';
import { NavigationSection } from '~/components/layout/NavigationSection';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  requireEditor(user);

  const [userIsAdmin, userIsPodcastEditor] = await Promise.all([
    isAdmin(user),
    isPodcastEditor(user),
  ]);

  return typedjson({ user, userIsAdmin, userIsPodcastEditor });
};

export default function Admin() {
  const { userIsAdmin, userIsPodcastEditor } =
    useTypedLoaderData<typeof loader>();

  const leaguesLinks = [
    { name: 'Registration List', href: '/admin/registration-list', current: false },
    { name: 'Seasons', href: '/admin/season', current: false },
    { name: 'Leagues', href: '/admin/leagues', current: false },
    { name: 'Cups', href: '/admin/cups', current: false },
    { name: 'Draft Slots', href: '/admin/draft-slots', current: false },
    { name: 'Add League', href: '/admin/leagues/new', current: false },
  ];

  const gamesLinks = [
    { name: 'Spread Pool', href: '/admin/spread-pool', current: false },
    { name: 'QB Streaming', href: '/admin/qb-streaming', current: false },
    { name: 'Locks Challenge', href: '/admin/locks-challenge', current: false },
    { name: 'DFS Survivor', href: '/admin/dfs-survivor', current: false },
  ];

  const omniLinks = [
    { name: 'Score Update', href: '/admin/omni/scoring', current: false },
    { name: 'Qualifying Points Update', href: '/admin/omni/qualifying-points', current: false },
    { name: 'Add Omni Player', href: '/admin/omni/add-player', current: false },
  ];

  const membersLinks = [
    { name: 'List', href: '/admin/members', current: false },
    { name: 'Add Members', href: '/admin/members/add', current: false },
  ];

  const dataLinks = [
    { name: 'Syncing', href: '/admin/data', current: false },
    { name: 'Scheduler', href: '/admin/scheduler', current: false },
  ];

  const botLinks = [
    { name: 'Commands', href: '/admin/bot', current: false },
  ];

  const podcastLinks = [
    { name: 'List', href: '/admin/podcasts', current: false },
    { name: 'Add', href: '/admin/podcasts/new', current: false },
  ];

  return (
    <>
      <h2>Admin</h2>
      <div className='grid md:grid-cols-12 md:gap-4'>
        <div className='not-prose text-sm md:col-span-3'>
          {userIsAdmin && (
            <>
              <NavigationSection 
                title="Leagues" 
                links={leaguesLinks} 
                headingId="admin-leagues-heading" 
              />
              <NavigationSection 
                title="Games" 
                links={gamesLinks} 
                headingId="admin-members-games" 
              />
              <NavigationSection 
                title="Omni" 
                links={omniLinks} 
                headingId="admin-omni-heading" 
              />
              <NavigationSection 
                title="Members" 
                links={membersLinks} 
                headingId="admin-members-heading" 
              />
              <NavigationSection 
                title="Data" 
                links={dataLinks} 
                headingId="admin-data-heading" 
              />
              <NavigationSection 
                title="Bot" 
                links={botLinks} 
                headingId="admin-bot-heading" 
              />
            </>
          )}
          {userIsPodcastEditor && (
            <NavigationSection 
              title="Podcast" 
              links={podcastLinks} 
              headingId="admin-podcast-heading" 
            />
          )}
        </div>
        <div className='md:col-span-9'>
          <Outlet />
        </div>
      </div>
    </>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error({error});
  // Don't forget to typecheck with your own logic.
  // Any value can be thrown, not just errors!
  let errorMessage = 'Unknown error';
  if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div>
      <h2>Error</h2>
      <pre>{errorMessage}</pre>
    </div>
  );
}
