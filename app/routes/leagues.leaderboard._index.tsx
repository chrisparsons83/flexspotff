import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import SeasonLeaderboard from '~/components/layout/leaderboard/SeasonLeaderboard';
import { EmptyState } from '~/components/ui/empty-state';
import { getCurrentSeason } from '~/models/season.server';
import { getTeamsInSeason } from '~/models/team.server';
import {
  getNewestWeekTeamGameByYear,
  getTeamGameYearlyTotals,
} from '~/models/teamgame.server';

export const loader = async () => {
  const currentSeason = await getCurrentSeason();
  if (!currentSeason) return typedjson({ season: null });

  const year = currentSeason.year;
  const [leaderboard, teams, newest] = await Promise.all([
    getTeamGameYearlyTotals(year),
    getTeamsInSeason(year),
    getNewestWeekTeamGameByYear(year),
  ]);

  return typedjson({
    season: { year, leaderboard, teams, newestWeek: newest._max.week },
  });
};

export default function LeaderboardIndex() {
  const { season } = useTypedLoaderData<typeof loader>();
  if (!season) return <EmptyState title='No season set up yet' />;

  return <SeasonLeaderboard {...season} maxYear={season.year} />;
}
