import type { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import clsx from 'clsx';
import { getOmniSeason, getOmniStandings } from '~/models/omniseason.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (!params.year) {
    throw new Error('No year param specified');
  }

  const year = Number(params.year);

  const seasonResults = await getOmniSeason(year);

  if (!seasonResults) {
    throw new Error('No season found');
  }

  const leaderboard = getOmniStandings(seasonResults);

  return { leaderboard, year };
};

export default function OmniLeaderboardYearIndex() {
  const { leaderboard, year } = useLoaderData<typeof loader>();

  return (
    <>
      <h2>{year} Omni Leaderboard</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Player</th>
            <th>Picks Remaining</th>
            <th>Total Points</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((position, index) => {
            return (
              <tr
                key={position.owner}
                className={clsx(
                  index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800',
                  'p-2',
                )}
              >
                <td className='pl-1'>
                  <div
                    className={clsx(
                      'mx-auto w-8 h-8 flex justify-center items-center font-bold text-sm',
                    )}
                  >
                    {position.rank}
                  </div>
                </td>
                <td>{position.owner}</td>
                <td>{position.remainingPlayers.toFixed(0)}</td>
                <td>{position.totalPoints.toFixed(0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
