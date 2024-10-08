import type { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import clsx from 'clsx';
import GoBox from '~/components/ui/GoBox';
import { getCurrentSeason } from '~/models/season.server';
import { getTeamsInSeason } from '~/models/team.server';
import { getTeamGameYearlyTotals } from '~/models/teamgame.server';
import { FIRST_YEAR } from '~/utils/constants';

export const loader = async ({ params }: LoaderFunctionArgs) => {
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

  const yearArray = Array.from(
    { length: maxYear - FIRST_YEAR + 1 },
    (_, i) => FIRST_YEAR + i,
  )
    .reverse()
    .map(yearNumber => ({
      label: `${yearNumber}`,
      url: `/leagues/leaderboard/${yearNumber}`,
    }));

  const rankColors: Record<string, string> = {
    admiral: 'bg-admiral text-gray-900',
    champions: 'bg-champions text-gray-900',
    dragon: 'bg-dragon text-gray-900',
    galaxy: 'bg-galaxy text-gray-900',
    monarch: 'bg-monarch text-gray-900',
  };

  return (
    <>
      <h2>Season Leaderboard</h2>
      <div className='float-right mb-4'>
        <GoBox options={yearArray} buttonText='Choose Year' />
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
          {leaderboard.map((position, index) => {
            const team = teams.find(team => team.id === position.teamId);
            if (!team) return null;

            return (
              <tr
                key={position.teamId}
                className={clsx(
                  index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800',
                  'p-2',
                )}
              >
                <td className='pl-1'>
                  <div
                    className={clsx(
                      rankColors[team.league.name.toLocaleLowerCase()],
                      'mx-auto w-8 h-8 flex justify-center items-center font-bold text-sm',
                    )}
                  >
                    {index + 1}
                  </div>
                </td>
                <td>{team.user?.discordName || 'Missing user'}</td>
                <td>{position._sum.pointsScored?.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
