import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import {
  authenticator,
  isAdmin,
  isPodcastEditor,
  requireEditor,
} from '~/services/auth.server';

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

  return (
    <>
      <h2>Admin</h2>
      <div className='grid md:grid-cols-12 md:gap-4'>
        <div className='not-prose text-sm md:col-span-3'>
          {userIsAdmin && (
            <>
              <section>
                <p
                  id='admin-leagues-heading'
                  className='mb-3 font-semibold text-slate-900 dark:text-slate-500'
                >
                  Leagues
                </p>
                <ul
                  aria-labelledby='admin-leagues-heading'
                  className='mb-8 space-y-2 p-0'
                >
                  <li className='flow-root'>
                    <Link
                      to='/admin/registration-list'
                      className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                    >
                      Registration List
                    </Link>
                  </li>
                  <li className='flow-root'>
                    <Link
                      to='/admin/season'
                      className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                    >
                      Seasons
                    </Link>
                  </li>
                  <li className='flow-root'>
                    <Link
                      to='/admin/leagues'
                      className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                    >
                      Leagues
                    </Link>
                  </li>
                  <li className='flow-root'>
                    <Link
                      to='/admin/cups'
                      className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                    >
                      Cups
                    </Link>
                  </li>
                  <li className='flow-root'>
                    <Link
                      to='/admin/leagues/new'
                      className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                    >
                      Add League
                    </Link>
                  </li>
                </ul>
              </section>
              <section>
                <p
                  id='admin-members-games'
                  className='mb-3 font-semibold text-slate-900 dark:text-slate-500'
                >
                  Games
                </p>
                <ul
                  aria-labelledby='admin-members-games'
                  className='mb-8 space-y-2 p-0'
                >
                  <li className='flow-root'>
                    <Link
                      to='/admin/spread-pool'
                      className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                    >
                      Spread Pool
                    </Link>
                  </li>
                  <li className='flow-root'>
                    <Link
                      to='/admin/qb-streaming'
                      className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                    >
                      QB Streaming
                    </Link>
                  </li>
                  <li className='flow-root'>
                    <Link
                      to='/admin/locks-challenge'
                      className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                    >
                      Locks Challenge
                    </Link>
                  </li>
                </ul>
              </section>
              <section>
                <p
                  id='admin-members-heading'
                  className='mb-3 font-semibold text-slate-900 dark:text-slate-500'
                >
                  Members
                </p>
                <ul
                  aria-labelledby='admin-members-heading'
                  className='mb-8 space-y-2 p-0'
                >
                  <li className='flow-root'>
                    <Link
                      to='/admin/members'
                      className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                    >
                      List
                    </Link>
                  </li>
                  <li className='flow-root'>
                    <Link
                      to='/admin/members/add'
                      className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                    >
                      Add Members
                    </Link>
                  </li>
                </ul>
              </section>
              <section>
                <p
                  id='admin-data-heading'
                  className='mb-3 font-semibold text-slate-900 dark:text-slate-500'
                >
                  Data
                </p>
                <ul
                  aria-labelledby='admin-data-heading'
                  className='mb-8 space-y-2 p-0'
                >
                  <li className='flow-root'>
                    <Link
                      to='/admin/data'
                      className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                    >
                      Syncing
                    </Link>
                  </li>
                </ul>
              </section>
              <section>
                <p
                  id='admin-bot-heading'
                  className='mb-3 font-semibold text-slate-900 dark:text-slate-500'
                >
                  Bot
                </p>
                <ul
                  aria-labelledby='admin-bot-heading'
                  className='mb-8 space-y-2 p-0'
                >
                  <li className='flow-root'>
                    <Link
                      to='/admin/bot'
                      className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                    >
                      Commands
                    </Link>
                  </li>
                </ul>
              </section>
            </>
          )}
          {userIsPodcastEditor && (
            <section>
              <p
                id='admin-podcast-heading'
                className='mb-3 font-semibold text-slate-900 dark:text-slate-500'
              >
                Podcast
              </p>
              <ul
                aria-labelledby='admin-podcast-heading'
                className='mb-8 space-y-2 p-0'
              >
                <li className='flow-root'>
                  <Link
                    to='/admin/podcasts'
                    className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                  >
                    List
                  </Link>
                </li>
                <li className='flow-root'>
                  <Link
                    to='/admin/podcasts/new'
                    className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                  >
                    Add
                  </Link>
                </li>
              </ul>
            </section>
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
  return (
    <div>
      <h2>Error</h2>
      <pre>{error.message}</pre>
    </div>
  );
}
