import { Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { NavigationSection } from '~/components/layout/NavigationSection';
import { prisma } from '~/db.server';
import { poolTitle } from '~/libs/survivor/views';
import { getLatestBestBallLeague } from '~/models/bestball.server';
import { getLatestD12Season } from '~/models/d12season.server';
import { getNewestD12WeekByYear } from '~/models/d12weekscore.server';
import { getLatestGuillotineLeagues } from '~/models/guillotine.server';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { getLatestSurvivorPools } from '~/models/survivor.server';
import { weeklyStandingsLink } from '~/utils/standings';

const navigationLinks = [
  { name: 'F²', href: '/games/f-squared', current: false },
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

  // Before the season's first week is created there are no weekly standings
  // to link to, so the weekly links are left out.
  const locksChallengeCurrentWeek = !locksChallengeWeek
    ? undefined
    : locksChallengeWeek.isWeekScored
    ? locksChallengeWeek.weekNumber
    : locksChallengeWeek.weekNumber - 1 || 1;

  // The latest scored DFS Survivor week, if any. Like the games above, the
  // weekly link is left out until there is one.
  const dfsSurvivorWeek = await prisma.dFSSurvivorUserWeek.findFirst({
    where: {
      year: currentSeason.year,
      isScored: true,
    },
    orderBy: {
      week: 'desc',
    },
  });
  const dfsSurvivorCurrentWeek = dfsSurvivorWeek?.week;

  const latestD12Season = await getLatestD12Season();
  const d12CurrentWeek = latestD12Season
    ? await getNewestD12WeekByYear(latestD12Season.year)
    : 1;

  const [guillotine, bestBall, survivorPools] = await Promise.all([
    getLatestGuillotineLeagues(),
    getLatestBestBallLeague(),
    getLatestSurvivorPools(),
  ]);

  return typedjson(
    {
      bestBall: bestBall
        ? { year: bestBall.season.year, name: bestBall.name }
        : null,
      guillotine,
      survivor: survivorPools.map(pool => ({
        id: pool.id,
        name: poolTitle(pool),
      })),
      qbStreamingCurrentWeek,
      spreadPoolCurrentWeek,
      locksChallengeCurrentWeek,
      dfsSurvivorCurrentWeek,
      currentSeason,
      d12Year: latestD12Season?.year ?? null,
      d12CurrentWeek,
    },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function GamesIndex() {
  const {
    bestBall,
    guillotine,
    survivor,
    qbStreamingCurrentWeek,
    spreadPoolCurrentWeek,
    locksChallengeCurrentWeek,
    dfsSurvivorCurrentWeek,
    currentSeason,
    d12Year,
    d12CurrentWeek,
  } = useTypedLoaderData<typeof loader>();

  const qbStreamingLinks = [
    { name: 'Rules', href: '/games/qb-streaming/rules', current: false },
    { name: 'My Entries', href: '/games/qb-streaming/entries', current: false },
    {
      name: 'Overall Standings',
      href: `/games/qb-streaming/standings/${currentSeason.year}`,
      current: false,
    },
    ...weeklyStandingsLink(
      '/games/qb-streaming/standings',
      currentSeason.year,
      qbStreamingCurrentWeek,
    ),
  ];

  const spreadPoolLinks = [
    { name: 'Rules', href: '/games/spread-pool/rules', current: false },
    { name: 'My Entries', href: '/games/spread-pool/entries', current: false },
    {
      name: 'Overall Standings',
      href: `/games/spread-pool/standings/${currentSeason.year}`,
      current: false,
    },
    ...weeklyStandingsLink(
      '/games/spread-pool/standings',
      currentSeason.year,
      spreadPoolCurrentWeek,
    ),
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
    ...weeklyStandingsLink(
      '/games/locks-challenge/standings',
      currentSeason.year,
      locksChallengeCurrentWeek,
    ),
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
    ...weeklyStandingsLink(
      '/games/dfs-survivor/standings',
      currentSeason.year,
      dfsSurvivorCurrentWeek,
    ),
  ];

  return (
    <>
      <h2>FlexSpotFF Games</h2>
      <div className='grid md:grid-cols-12 md:gap-4'>
        <div className='not-prose text-sm md:col-span-2'>
          <NavigationSection
            title='Games'
            links={navigationLinks}
            headingId='admin-leagues-heading'
          />
          <NavigationSection
            title='Spread Pool'
            links={spreadPoolLinks}
            headingId='games-spreadPool-heading'
          />
          <NavigationSection
            title='QB Streaming Challenge'
            links={qbStreamingLinks}
          />
          <NavigationSection
            title='Locks Challenge'
            links={nflLocksChallengeLinks}
            headingId='games-locksChallenge-heading'
          />
          <NavigationSection
            title='DFS Survivor'
            links={dfsSurvivorLinks}
            headingId='games-dfssurvivor-heading'
          />
          {d12Year && (
            <NavigationSection
              title='D12'
              links={[
                {
                  name: 'Leaderboard',
                  href: `/games/d12/${d12Year}`,
                  current: false,
                },
                {
                  name: 'Weekly Leaderboards',
                  href: `/games/d12/${d12Year}/${d12CurrentWeek}`,
                  current: false,
                },
                {
                  name: 'ADP',
                  href: `/games/d12/adp/${d12Year}`,
                  current: false,
                },
              ]}
              headingId='games-d12-heading'
            />
          )}
          {guillotine && (
            <NavigationSection
              title='Guillotine'
              links={[
                ...guillotine.leagues.map(league => ({
                  name: `${guillotine.year} ${league.name}`,
                  href: `/games/guillotine/${league.id}`,
                  current: false,
                })),
                {
                  name: 'All Seasons',
                  href: '/games/guillotine',
                  current: false,
                },
              ]}
              headingId='games-guillotine-heading'
            />
          )}
          {bestBall && (
            <NavigationSection
              title='Autodraft BBM'
              links={[
                {
                  name: `${bestBall.year} Standings`,
                  href: `/games/best-ball/${bestBall.year}`,
                  current: false,
                },
                {
                  name: `${bestBall.year} Draft`,
                  href: `/games/best-ball/${bestBall.year}/draft`,
                  current: false,
                },
                {
                  name: 'All Seasons',
                  href: '/games/best-ball',
                  current: false,
                },
              ]}
              headingId='games-best-ball-heading'
            />
          )}
          <NavigationSection
            title='Survivor'
            links={[
              ...survivor.map(pool => ({
                name: pool.name,
                href: `/games/survivor/${pool.id}`,
                current: false,
              })),
              { name: 'All Pools', href: '/games/survivor', current: false },
            ]}
            headingId='games-survivor-heading'
          />
        </div>
        <div className='min-w-0 md:col-span-10'>
          <Outlet />
        </div>
      </div>
    </>
  );
}
