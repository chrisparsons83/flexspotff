import type { LoaderArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import clsx from 'clsx';
import GoBox from '~/components/ui/GoBox';
import { getCurrentSeason } from '~/models/season.server';
import { getTeamsInSeason } from '~/models/team.server';
import { getTeamGameYearlyTotals } from '~/models/teamgame.server';
import { FIRST_YEAR, RANK_COLORS, isLeagueName } from '~/utils/constants';

export const loader = async ({ params }: LoaderArgs) => {
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

  const yearArray = Array.from(
    { length: maxYear - FIRST_YEAR + 1 },
    (_, i) => FIRST_YEAR + i,
  )
    .reverse()
    .map(yearNumber => ({
      label: `${yearNumber}`,
      url: `/leagues/leaderboard/${yearNumber}`,
    }));

  return (
    <>
      <h2>{year} Season Leaderboard</h2>
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

            const teamLeague = team.league.name.toLocaleLowerCase();

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
                      isLeagueName(teamLeague) && RANK_COLORS[teamLeague],
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
