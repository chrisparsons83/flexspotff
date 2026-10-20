import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { guillotineTabs } from '~/components/layout/side-leagues/tabs';
import GoBox from '~/components/ui/GoBox';
import { ExternalLink } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { SubNav } from '~/components/ui/sub-nav';
import { prisma } from '~/db.server';
import { requireGuillotineAccess } from '~/libs/guillotine/access.server';
import { GUILLOTINE_FINAL_WEEK } from '~/libs/guillotine/chops';
import { getAllGuillotineLeagues } from '~/models/guillotine.server';
import { type RouteHandle, dataOf } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ data }) => {
    const league = dataOf<typeof loader>(data)?.league;
    return league && `${league.year} ${league.name}`;
  },
};

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
      url: `/side-leagues/guillotine/${l.id}`,
    })),
  });
};

export default function GuillotineLeagueLayout() {
  const { league, currentWeek, allLeagues } =
    useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader
        title={league.name}
        description={`Guillotine, ${league.year}. ${
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
            label={league.name}
            items={guillotineTabs({ id: league.id, currentWeek })}
            picker={<GoBox options={allLeagues} buttonText='League' />}
          />
        }
      />
      <Outlet />
    </>
  );
}
