import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import SeasonLeaderboard from '~/components/layout/leaderboard/SeasonLeaderboard';
import { getCurrentSeason } from '~/models/season.server';
import { getTeamsInSeason } from '~/models/team.server';
import {
  getNewestWeekTeamGameByYear,
  getTeamGameYearlyTotals,
} from '~/models/teamgame.server';
import { FIRST_YEAR } from '~/utils/constants';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: ({ params }) => params.year };

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < FIRST_YEAR) {
    throw new Response('Season not found', { status: 404 });
  }

  const [currentSeason, leaderboard, teams, newest] = await Promise.all([
    getCurrentSeason(),
    getTeamGameYearlyTotals(year),
    getTeamsInSeason(year),
    getNewestWeekTeamGameByYear(year),
  ]);

  return typedjson({
    year,
    leaderboard,
    teams,
    newestWeek: newest._max.week,
    maxYear: currentSeason?.year ?? year,
  });
};

export default function LeaderboardYearIndex() {
  const data = useTypedLoaderData<typeof loader>();
  return <SeasonLeaderboard {...data} />;
}
