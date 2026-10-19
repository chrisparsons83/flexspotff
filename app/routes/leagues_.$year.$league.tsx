import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import {
  typedjson,
  useTypedLoaderData,
  useTypedRouteLoaderData,
} from 'remix-typedjson';
import GoBox from '~/components/ui/GoBox';
import { PageHeader } from '~/components/ui/page-header';
import { SubNav } from '~/components/ui/sub-nav';
import { requireLeague } from '~/libs/leagues/page.server';
import { countDraftPicksByLeague } from '~/models/draftpick.server';
import { getLeagueYearsByName, getLeaguesByYear } from '~/models/league.server';
import { countPlayoffGamesByLeague } from '~/models/playoffgame.server';
import { getTeamGameWeeksByLeague } from '~/models/teamgame.server';
import { countWaiverTransactionsByLeague } from '~/models/waiver.server';

export const ROUTE_ID = 'routes/leagues_.$year.$league';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const league = await requireLeague({ params, request });

  const [years, sameYear, weeks, playoffGames, draftPicks, waivers] =
    await Promise.all([
      getLeagueYearsByName(league.name),
      getLeaguesByYear(league.year),
      getTeamGameWeeksByLeague(league.id),
      countPlayoffGamesByLeague(league.id),
      countDraftPicksByLeague(league.id),
      countWaiverTransactionsByLeague(league.id),
    ]);

  return typedjson({
    league,
    years,
    sameYear: sameYear.map(other => other.name),
    // A tab shows only when there is something on it.
    has: {
      matchups: weeks.length > 0,
      playoffs: playoffGames > 0,
      draft: draftPicks > 0,
      transactions: waivers > 0,
    },
  });
};

/** The league, for the tabs under this layout. */
export const useLeague = () =>
  useTypedRouteLoaderData<typeof loader>(ROUTE_ID)!.league;

export default function LeaguePage() {
  const { league, years, sameYear, has } = useTypedLoaderData<typeof loader>();
  const base = `/leagues/${league.year}/${league.name.toLowerCase()}`;

  const items = [
    { label: 'Standings', to: base, end: true },
    ...(has.matchups ? [{ label: 'Matchups', to: `${base}/matchups` }] : []),
    ...(has.playoffs ? [{ label: 'Playoffs', to: `${base}/playoffs` }] : []),
    ...(has.draft ? [{ label: 'Draft', to: `${base}/draft` }] : []),
    ...(has.transactions
      ? [{ label: 'Transactions', to: `${base}/transactions` }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={league.name}
        description={`The ${league.year} season, tier ${league.tier}.`}
        actions={
          years.length > 1 && (
            <GoBox
              buttonText='Season'
              options={years.map(year => ({
                label: `${year}`,
                url: `/leagues/${year}/${league.name.toLowerCase()}`,
              }))}
            />
          )
        }
        nav={
          <SubNav
            label={league.name}
            items={items}
            picker={
              sameYear.length > 1 && (
                <GoBox
                  buttonText={`${league.year} leagues`}
                  options={sameYear.map(name => ({
                    label: name,
                    url: `/leagues/${league.year}/${name.toLowerCase()}`,
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
