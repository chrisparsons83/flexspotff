import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';

const navigationLinks = [
  { name: 'F²', href: '/games/f-squared', current: false },
  { name: 'Survivor', href: '/games/survivor', current: false },
];

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const qbStreamingCurrentWeek = (
    await getQBStreamingWeeks(currentSeason.year)
  )[0]?.week;

  const spreadPoolCurrentWeek = (
    await getPoolWeeksByYear(currentSeason.year)
  )[0]?.weekNumber;

  let locksChallengeWeek = (
    await getLocksWeeksByYear(currentSeason.year)
  )[0];
  
  const locksChallengeCurrentWeek = (locksChallengeWeek?.isWeekScored && (locksChallengeWeek?.weekNumber === 0)) ? locksChallengeWeek?.weekNumber : (locksChallengeWeek?.weekNumber - 1 ? locksChallengeWeek?.weekNumber - 1 : 1);

  return typedjson(
    {
      qbStreamingCurrentWeek,
      spreadPoolCurrentWeek,
      locksChallengeCurrentWeek,
      currentSeason,
    },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function GamesIndex() {
  const {
    qbStreamingCurrentWeek,
    spreadPoolCurrentWeek,
    locksChallengeCurrentWeek,
    currentSeason,
  } = useTypedLoaderData<typeof loader>();

  const qbStreamingLinks = [
    { name: 'Rules', href: '/games/qb-streaming/rules', current: false },
    { name: 'My Entries', href: '/games/qb-streaming/entries', current: false },
    {
      name: 'Overall Standings',
      href: `/games/qb-streaming/standings/${currentSeason.year}`,
      current: false,
    },
    {
      name: 'Weekly Standings',
      href: `/games/qb-streaming/standings/${currentSeason.year}/${qbStreamingCurrentWeek}`,
      current: false,
    },
  ];

  const spreadPoolLinks = [
    { name: 'Rules', href: '/games/spread-pool/rules', current: false },
    { name: 'My Entries', href: '/games/spread-pool/entries', current: false },
    {
      name: 'Overall Standings',
      href: `/games/spread-pool/standings/${currentSeason.year}`,
      current: false,
    },
    {
      name: 'Weekly Standings',
      href: `/games/spread-pool/standings/${currentSeason.year}/${spreadPoolCurrentWeek}`,
      current: false,
    },
  ];

  const nflLocksChallengeLinks = [
    { name: 'Rules', href: '/games/locks-challenge/rules', current: false },
    {
      name: 'My Entries',
      href: '/games/locks-challenge/entries',
      current: false,
    },
    {
      name: 'Overall Standings',
      href: `/games/locks-challenge/standings/${currentSeason.year}`,
      current: false,
    },
    {
      name: 'Weekly Standings',
      href: `/games/locks-challenge/standings/${currentSeason.year}/${locksChallengeCurrentWeek}`,
      current: false,
    },
  ];

  return (
    <>
      <h2>FlexSpotFF Games</h2>
      <div className='grid md:grid-cols-12 md:gap-4'>
        <div className='not-prose text-sm md:col-span-2'>
          <section>
            <p
              id='admin-leagues-heading'
              className='mb-3 font-semibold text-slate-900 dark:text-slate-500'
            >
              Games
            </p>
            <ul
              aria-labelledby='admin-leagues-heading'
              className='mb-8 space-y-2 p-0'
            >
              {navigationLinks.map(navLink => (
                <li key={navLink.name} className='flow-root'>
                  <Link
                    to={navLink.href}
                    className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                  >
                    {navLink.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p
              id='games-spreadPool-heading'
              className='mb-3 font-semibold text-slate-900 dark:text-slate-500'
            >
              Spread Pool
            </p>
            <ul
              aria-labelledby='games-spreadPool-heading'
              className='mb-8 space-y-2 p-0'
            >
              {spreadPoolLinks.map(navLink => (
                <li key={navLink.name} className='flow-root'>
                  <Link
                    to={navLink.href}
                    className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                  >
                    {navLink.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p
              id='admin-leagues-heading'
              className='mb-3 font-semibold text-slate-900 dark:text-slate-500'
            >
              QB Streaming Challenge
            </p>
            <ul
              aria-labelledby='admin-leagues-heading'
              className='mb-8 space-y-2 p-0'
            >
              {qbStreamingLinks.map(navLink => (
                <li key={navLink.name} className='flow-root'>
                  <Link
                    to={navLink.href}
                    className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                  >
                    {navLink.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p
              id='games-locksChallenge-heading'
              className='mb-3 font-semibold text-slate-900 dark:text-slate-500'
            >
              Locks Challenge
            </p>
            <ul
              aria-labelledby='games-locksChallenge-heading'
              className='mb-8 space-y-2 p-0'
            >
              {nflLocksChallengeLinks.map(navLink => (
                <li key={navLink.name} className='flow-root'>
                  <Link
                    to={navLink.href}
                    className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                  >
                    {navLink.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className='md:col-span-10'>
          <Outlet />
        </div>
      </div>
    </>
  );
}
