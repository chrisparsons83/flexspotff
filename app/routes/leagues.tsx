import { Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { getCurrentSeason } from '~/models/season.server';
import { getNewestWeekTeamGameByYear } from '~/models/teamgame.server';
import { NavigationSection } from '~/components/layout/NavigationSection';

export const loader = async () => {
  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const teamGameNewestWeek =
    (await getNewestWeekTeamGameByYear(currentSeason.year))._max.week || 1;

  return typedjson({
    teamGameNewestWeek,
    currentSeason,
  });
};

export default function LeaguesIndex() {
  const { teamGameNewestWeek, currentSeason } =
    useTypedLoaderData<typeof loader>();

  const navigationLinks = [
    {
      name: 'Overall Leaderboard',
      href: '/leagues/leaderboard',
      current: false,
    },
    {
      name: 'Weekly Leaderboards',
      href: `/leagues/leaderboard/${currentSeason.year}/${teamGameNewestWeek}`,
      current: false,
    },
    { name: 'Standings', href: '/leagues/standings', current: false },
    { name: 'Cup', href: `/leagues/cup/${currentSeason.year}`, current: false },
    { name: 'ADP', href: '/leagues/adp', current: false },
    { name: 'Records', href: '/leagues/records', current: false },
    { name: 'Rules', href: '/leagues/rules', current: false },
  ];

  return (
    <>
      <h2>FlexSpotFF Leagues</h2>
      <div className='grid md:grid-cols-12 md:gap-4'>
        <div className='not-prose text-sm md:col-span-2'>
          <NavigationSection 
            title="Leagues" 
            links={navigationLinks} 
            headingId="admin-leagues-heading" 
          />
        </div>
        <div className='md:col-span-10'>
          <Outlet />
        </div>
      </div>
    </>
  );
}
