import type { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import SeasonLeaderboard from '~/components/layout/leaderboard/SeasonLeaderboard';
import { getCurrentSeason } from '~/models/season.server';
import { getTeamsInSeason } from '~/models/team.server';
import { getTeamGameYearlyTotals } from '~/models/teamgame.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (!params.year) {
    throw new Error('No year param specified');
  }

  const year = Number(params.year);

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('Missing current season');
  }

  const leaderboard = await getTeamGameYearlyTotals(year);
  const teams = await getTeamsInSeason(year);

  return { leaderboard, teams, year, maxYear: currentSeason.year };
};

export default function LeaderboardYearIndex() {
  const { leaderboard, teams, year, maxYear } = useLoaderData<typeof loader>();

  return (
    <SeasonLeaderboard
      heading={`${year} Season Leaderboard`}
      leaderboard={leaderboard}
      teams={teams}
      maxYear={maxYear}
    />
  );
}
