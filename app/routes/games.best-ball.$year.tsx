import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, Outlet, useLocation } from '@remix-run/react';
import clsx from 'clsx';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import GoBox from '~/components/ui/GoBox';
import { requireBestBallAccess } from '~/libs/best-ball/access.server';
import {
  getAllBestBallLeagues,
  getBestBallLeagueByYear,
} from '~/models/bestball.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireBestBallAccess(request);

  const [league, allLeagues] = await Promise.all([
    getBestBallLeagueByYear(Number(params.year)),
    getAllBestBallLeagues(),
  ]);
  if (!league) throw new Response('Season not found', { status: 404 });

  return typedjson({
    league: {
      name: league.name,
      year: league.season.year,
      isComplete: league.isComplete,
      lastScoredWeek: league.lastScoredWeek,
      sleeperLeagueId: league.sleeperLeagueId,
    },
    allLeagues: allLeagues.map(l => ({
      label: `${l.season.year} ${l.name}`,
      url: `/games/best-ball/${l.season.year}`,
    })),
  });
};

export default function BestBallSeasonLayout() {
  const { league, allLeagues } = useTypedLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const base = `/games/best-ball/${league.year}`;

  const tabs = [
    { label: 'Standings', to: base, active: pathname === base },
    {
      label: 'Draft',
      to: `${base}/draft`,
      active: pathname === `${base}/draft`,
    },
  ];

  return (
    <div>
      <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
        <h2 className='mb-0 break-words'>
          {league.year} {league.name}
        </h2>
        <GoBox options={allLeagues} buttonText='Choose Season' />
      </div>
      <p className='mt-1 text-sm'>
        {league.isComplete
          ? 'Final.'
          : league.lastScoredWeek > 0
          ? `Live: scored through week ${league.lastScoredWeek}.`
          : 'Live: no weeks scored yet.'}{' '}
        <Link to='/games/best-ball'>All seasons</Link> ·{' '}
        <a
          href={`https://sleeper.com/leagues/${league.sleeperLeagueId}`}
          target='_blank'
          rel='noreferrer'
        >
          Open in Sleeper
        </a>
      </p>

      <nav
        aria-label='Season sections'
        className='not-prose mb-6 overflow-x-auto border-b border-slate-600/60'
      >
        <ul className='m-0 flex min-w-max gap-1 p-0'>
          {tabs.map(tab => (
            <li key={tab.label} className='list-none'>
              <Link
                to={tab.to}
                prefetch='intent'
                aria-current={tab.active ? 'page' : undefined}
                className={clsx(
                  'block whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold no-underline',
                  tab.active
                    ? 'border-blue-400 text-white'
                    : 'border-transparent text-slate-400 hover:text-white',
                )}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet />
    </div>
  );
}
