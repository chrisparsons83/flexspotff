import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet, useLocation } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import GoBox from '~/components/ui/GoBox';
import { PageHeader } from '~/components/ui/page-header';
import { SubNav } from '~/components/ui/sub-nav';
import { getCups } from '~/models/cup.server';
import { getCurrentSeason } from '~/models/season.server';
import type { RouteHandle } from '~/utils/route-handle';
import { yearOptions } from '~/utils/years';

export const handle: RouteHandle = { title: 'Leagues' };

/** The year in the URL, on the tabs that have one. */
const yearParam = (params: LoaderFunctionArgs['params']) =>
  params.year && /^\d+$/.test(params.year) ? Number(params.year) : null;

/**
 * One season for the whole section: the header's year picker moves the tab
 * you are on to another year.
 */
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const [season, cups] = await Promise.all([getCurrentSeason(), getCups()]);

  return typedjson({
    year: yearParam(params) ?? season?.year ?? null,
    currentYear: season?.year ?? null,
    cupYears: cups.map(cup => cup.year).sort((a, b) => b - a),
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

/**
 * The tabs that show one season, and where each keeps it. Read from the
 * location rather than the loader: moving between two of them changes no
 * params, so the layout's loader does not run again.
 */
const SEASON_TABS = ['standings', 'leaderboard', 'cup', 'adp'] as const;

export default function Leagues() {
  const { year, currentYear, cupYears } = useTypedLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const tab = SEASON_TABS.find(name => pathname.startsWith(`/leagues/${name}`));
  const years =
    tab === 'cup'
      ? cupYears.map(cupYear => ({
          label: `${cupYear}`,
          url: `/leagues/cup/${cupYear}`,
        }))
      : tab && currentYear
      ? yearOptions(currentYear, option => `/leagues/${tab}/${option}`)
      : [];

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
              years.length > 0 && (
                <GoBox buttonText={`${year} Season`} options={years} />
              )
            }
          />
        }
      />
      <Outlet />
    </>
  );
}
