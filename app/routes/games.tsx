import { Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { prisma } from '~/db.server';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { NavigationSection } from '~/components/layout/NavigationSection';

const navigationLinks = [
  { name: 'F²', href: '/games/f-squared', current: false },
  { name: 'Survivor', href: '/games/survivor', current: false },
];

export const loader = async () => {
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

  let locksChallengeWeek = (await getLocksWeeksByYear(currentSeason.year))[0];

  const locksChallengeCurrentWeek = locksChallengeWeek?.isWeekScored
    ? locksChallengeWeek?.weekNumber
    : locksChallengeWeek?.weekNumber - 1 || 1;

  // Get the current DFS Survivor week
  const dfsSurvivorWeek = await prisma.dFSSurvivorUserWeek.findFirst({
    where: {
      year: currentSeason.year,
      isScored: true,
    },
    orderBy: {
      week: 'desc',
    },
  });
  const dfsSurvivorCurrentWeek = dfsSurvivorWeek?.week || 1;

  return typedjson(
    {
      qbStreamingCurrentWeek,
      spreadPoolCurrentWeek,
      locksChallengeCurrentWeek,
      dfsSurvivorCurrentWeek,
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
    dfsSurvivorCurrentWeek,
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

  const dfsSurvivorLinks = [
    { name: 'Rules', href: '/games/dfs-survivor/rules', current: false },
    {
      name: 'My Entries',
      href: '/games/dfs-survivor/entries',
      current: false,
    },
    {
      name: 'Overall Standings',
      href: `/games/dfs-survivor/standings/${currentSeason.year}`,
      current: false,
    },
    {
      name: 'Weekly Standings',
      href: `/games/dfs-survivor/standings/${currentSeason.year}/${dfsSurvivorCurrentWeek}`,
      current: false,
    },
  ];

  return (
    <>
      <h2>FlexSpotFF Games</h2>
      <div className='grid md:grid-cols-12 md:gap-4'>
        <div className='not-prose text-sm md:col-span-2'>
          <NavigationSection 
            title="Games" 
            links={navigationLinks} 
            headingId="admin-leagues-heading" 
          />
          <NavigationSection 
            title="Spread Pool" 
            links={spreadPoolLinks} 
            headingId="games-spreadPool-heading" 
          />
          <NavigationSection 
            title="QB Streaming Challenge" 
            links={qbStreamingLinks} 
          />
          <NavigationSection 
            title="Locks Challenge" 
            links={nflLocksChallengeLinks} 
            headingId="games-locksChallenge-heading" 
          />
          <NavigationSection 
            title="DFS Survivor" 
            links={dfsSurvivorLinks} 
            headingId="games-dfssurvivor-heading" 
          />
        </div>
        <div className='md:col-span-10'>
          <Outlet />
        </div>
      </div>
    </>
  );
}
