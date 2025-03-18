import type { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import clsx from 'clsx';
import { getOmniSeason } from '~/models/omniseason.server';
import { getCurrentSeason } from '~/models/season.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (!params.year) {
    throw new Error('No year param specified');
  }

  const year = Number(params.year);

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('Missing current season');
  }

  const seasonResults = await getOmniSeason(year);

  if (!seasonResults) {
    throw new Error('No season found');
  }

  const rankedPoints = seasonResults.omniTeams
    .map(omniTeam =>
      omniTeam.draftPicks.reduce(
        (acc, pick) => acc + (pick.player?.pointsScored || 0),
        0,
      ),
    )
    .sort()
    .reverse();

  const leaderboard = seasonResults.omniTeams
    .map(omniTeam => {
      const totalPoints = omniTeam.draftPicks.reduce(
        (acc, pick) => acc + (pick.player?.pointsScored || 0),
        0,
      );

      return {
        owner: omniTeam.user?.discordName || '',
        totalPoints,
        rank: rankedPoints.findIndex(rank => rank === totalPoints) + 1,
      };
    })
    .sort((a, b) => {
      if (a.totalPoints < b.totalPoints) {
        return 1;
      } else if (a.totalPoints > b.totalPoints) {
        return -1;
      } else {
        return a.owner.localeCompare(b.owner);
      }
    });

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
            <th>Points</th>
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
                <td>{position.totalPoints.toFixed(0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
