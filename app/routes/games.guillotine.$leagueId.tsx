import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, Outlet, useLocation } from '@remix-run/react';
import clsx from 'clsx';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import GoBox from '~/components/ui/GoBox';
import { prisma } from '~/db.server';
import { requireGuillotineAccess } from '~/libs/guillotine/access.server';
import { GUILLOTINE_FINAL_WEEK } from '~/libs/guillotine/chops';
import { getAllGuillotineLeagues } from '~/models/guillotine.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireGuillotineAccess(request);

  const [league, allLeagues] = await Promise.all([
    prisma.guillotineLeague.findUnique({
      where: { id: params.leagueId },
      include: { season: { select: { year: true } } },
    }),
    getAllGuillotineLeagues(),
  ]);
  if (!league) throw new Response('League not found', { status: 404 });

  // The week the tabs should open on: the one being played, or the last one.
  const currentWeek = league.isComplete
    ? GUILLOTINE_FINAL_WEEK
    : Math.min(Math.max(league.lastScoredWeek + 1, 1), GUILLOTINE_FINAL_WEEK);

  return typedjson({
    league: {
      id: league.id,
      name: league.name,
      year: league.season.year,
      isComplete: league.isComplete,
      lastScoredWeek: league.lastScoredWeek,
      sleeperLeagueId: league.sleeperLeagueId,
    },
    currentWeek,
    allLeagues: allLeagues.map(l => ({
      label: `${l.season.year} ${l.name}`,
      url: `/games/guillotine/${l.id}`,
    })),
  });
};

export default function GuillotineLeagueLayout() {
  const { league, currentWeek, allLeagues } =
    useTypedLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const base = `/games/guillotine/${league.id}`;

  const tabs = [
    { label: 'Chop Tracker', to: base, active: pathname === base },
    {
      label: 'Weeks',
      to: `${base}/week/${currentWeek}`,
      active: pathname.startsWith(`${base}/week`),
    },
    {
      label: 'Waivers',
      to: `${base}/waivers`,
      active: pathname === `${base}/waivers`,
    },
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
        <GoBox options={allLeagues} buttonText='Choose League' />
      </div>
      <p className='mt-1 text-sm'>
        {league.isComplete
          ? 'Final.'
          : league.lastScoredWeek > 0
          ? `Live: scored through week ${league.lastScoredWeek}.`
          : 'Live: no weeks scored yet.'}{' '}
        <a
          href={`https://sleeper.com/leagues/${league.sleeperLeagueId}`}
          target='_blank'
          rel='noreferrer'
        >
          Open in Sleeper
        </a>
      </p>

      <nav
        aria-label='League sections'
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
