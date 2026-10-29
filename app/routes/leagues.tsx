import { Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import GoBox from '~/components/ui/GoBox';
import { PageHeader } from '~/components/ui/page-header';
import { SubNav } from '~/components/ui/sub-nav';
import { getLeaguesByYear } from '~/models/league.server';
import { getCurrentSeason } from '~/models/season.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Leagues' };

export const loader = async () => {
  const season = await getCurrentSeason();
  const leagues = season ? await getLeaguesByYear(season.year) : [];

  return typedjson({
    year: season?.year ?? null,
    leagues: leagues.map(league => league.name),
  });
};

const ITEMS = [
  { label: 'Overview', to: '/leagues', end: true },
  { label: 'Standings', to: '/leagues/standings' },
  { label: 'Leaderboard', to: '/leagues/leaderboard' },
  { label: 'Cup', to: '/leagues/cup' },
  { label: 'Records', to: '/leagues/records' },
  { label: 'ADP', to: '/leagues/adp' },
  { label: 'Rules', to: '/leagues/rules' },
];

export default function Leagues() {
  const { year, leagues } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader
        title='Leagues'
        description='Twelve-team leagues in two tiers, with promotion and relegation between them every season and a cross-league cup between them all.'
        nav={
          <SubNav
            label='Leagues'
            items={ITEMS}
            picker={
              year &&
              leagues.length > 0 && (
                <GoBox
                  buttonText={`${year} Leagues`}
                  options={leagues.map(name => ({
                    label: name,
                    url: `/leagues/${year}/${name.toLowerCase()}`,
                  }))}
                />
              )
            }
          />
        }
      />
      <Outlet />
    </>
  );
}
