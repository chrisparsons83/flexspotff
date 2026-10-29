import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import SeasonLeaderboard from '~/components/layout/leaderboard/SeasonLeaderboard';
import { getTeamsInSeason } from '~/models/team.server';
import {
  getNewestWeekTeamGameByYear,
  getTeamGameYearlyTotals,
} from '~/models/teamgame.server';
import { FIRST_YEAR } from '~/utils/constants';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < FIRST_YEAR) {
    throw new Response('Season not found', { status: 404 });
  }

  const [leaderboard, teams, newest] = await Promise.all([
    getTeamGameYearlyTotals(year),
    getTeamsInSeason(year),
    getNewestWeekTeamGameByYear(year),
  ]);

  return typedjson({
    year,
    leaderboard,
    teams,
    newestWeek: newest._max.week,
  });
};

export default function LeaderboardYearIndex() {
  const data = useTypedLoaderData<typeof loader>();
  return <SeasonLeaderboard {...data} />;
}
