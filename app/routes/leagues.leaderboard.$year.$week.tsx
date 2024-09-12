import type { LoaderArgs } from '@remix-run/node';
import LeaderboardRow from '~/components/layout/leaderboard/LeaderboardRow';
import GoBox from '~/components/ui/GoBox';
import { getCurrentSeason } from '~/models/season.server';
import {
  getNewestWeekTeamGameByYear,
  getTeamGamesByYearAndWeek,
} from '~/models/teamgame.server';
import { superjson, useSuperLoaderData } from '~/utils/data';

type LoaderData = {
  leaderboard: Awaited<ReturnType<typeof getTeamGamesByYearAndWeek>>;
  week: number;
  year: number;
  maxWeek: number;
};

export const loader = async ({ params }: LoaderArgs) => {
  const year = Number(params.year);
  const week = Number(params.week);

  const leaderboard = await getTeamGamesByYearAndWeek(year, week);

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const maxWeek =
    (await getNewestWeekTeamGameByYear(currentSeason.year))._max.week || 1;

  return superjson<LoaderData>(
    { leaderboard, week, maxWeek, year },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function LeaderboardYearWeek() {
  const { leaderboard, week, maxWeek, year } =
    useSuperLoaderData<typeof loader>();

  const weekArray = Array.from({ length: maxWeek }, (_, i) => i + 1)
    .reverse()
    .map(weekNumber => ({
      label: `Week ${weekNumber}`,
      url: `/leagues/leaderboard/${year}/${weekNumber}`,
    }));

  return (
    <>
      <h2>Week {week} Leaderboard</h2>

      <div className='float-right mb-4'>
        <GoBox options={weekArray} buttonText='Choose Week' />
      </div>

      <table>
        <thead>
          <tr>
            <th></th>
            <th>Player</th>
            <th>Points For</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((position, index) => (
            <LeaderboardRow
              key={position.id}
              position={position}
              rank={index + 1}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}
