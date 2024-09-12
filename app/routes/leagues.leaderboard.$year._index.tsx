import type { LoaderArgs } from '@remix-run/node';
import clsx from 'clsx';

import { getTeamsInSeason } from '~/models/team.server';
import { getTeamGameYearlyTotals } from '~/models/teamgame.server';

import { RANK_COLORS, isLeagueName } from '~/utils/constants';
import { superjson, useSuperLoaderData } from '~/utils/data';

type LoaderData = {
  leaderboard: Awaited<ReturnType<typeof getTeamGameYearlyTotals>>;
  teams: Awaited<ReturnType<typeof getTeamsInSeason>>;
  year: number;
};

export const loader = async ({ params }: LoaderArgs) => {
  if (!params.year) {
    throw new Error('No year param specified');
  }

  const year = Number(params.year);

  const leaderboard = await getTeamGameYearlyTotals(year);
  const teams = await getTeamsInSeason(year);

  return superjson<LoaderData>(
    { leaderboard, teams, year },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function LeaderboardYearIndex() {
  const { leaderboard, teams, year } = useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2>{year} Season Leaderboard</h2>
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
