import { useLoaderData } from '@remix-run/react';
import SeasonLeaderboard from '~/components/layout/leaderboard/SeasonLeaderboard';
import { getCurrentSeason } from '~/models/season.server';
import { getTeamsInSeason } from '~/models/team.server';
import { getTeamGameYearlyTotals } from '~/models/teamgame.server';

export const loader = async () => {
  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const leaderboard = await getTeamGameYearlyTotals(currentSeason.year);
  const teams = await getTeamsInSeason(currentSeason.year);

  return { leaderboard, teams, maxYear: currentSeason.year };
};

export default function LeaderboardIndex() {
  const { leaderboard, teams, maxYear } = useLoaderData<typeof loader>();

  return (
    <SeasonLeaderboard
      heading='Season Leaderboard'
      leaderboard={leaderboard}
      teams={teams}
      maxYear={maxYear}
    />
  );
}
