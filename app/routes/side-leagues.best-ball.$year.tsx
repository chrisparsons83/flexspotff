import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { bestBallTabs } from '~/components/layout/side-leagues/tabs';
import GoBox from '~/components/ui/GoBox';
import { ExternalLink } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { SubNav } from '~/components/ui/sub-nav';
import { requireBestBallAccess } from '~/libs/best-ball/access.server';
import {
  getAllBestBallLeagues,
  getBestBallLeagueByYear,
} from '~/models/bestball.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: ({ params }) => params.year };

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
      url: `/side-leagues/best-ball/${l.season.year}`,
    })),
  });
};

export default function BestBallSeasonLayout() {
  const { league, allLeagues } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader
        title={`Autodraft BBM ${league.year}`}
        description={`${league.name}. ${
          league.isComplete
            ? 'Final.'
            : league.lastScoredWeek > 0
            ? `Live: scored through week ${league.lastScoredWeek}.`
            : 'Live: no weeks scored yet.'
        }`}
        actions={
          <ExternalLink
            href={`https://sleeper.com/leagues/${league.sleeperLeagueId}`}
            target='_blank'
          >
            Open in Sleeper
          </ExternalLink>
        }
        nav={
          <SubNav
            label='Autodraft BBM'
            items={bestBallTabs(league.year)}
            picker={<GoBox options={allLeagues} buttonText='Season' />}
          />
        }
      />
      <Outlet />
    </>
  );
}
