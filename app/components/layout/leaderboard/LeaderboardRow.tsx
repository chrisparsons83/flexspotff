import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/outline';
import clsx from 'clsx';
import { useState } from 'react';

import type { League } from '~/models/league.server';
import type { Player } from '~/models/players.server';
import type { Team } from '~/models/team.server';
import type { TeamGame } from '~/models/teamgame.server';
import type { User } from '~/models/user.server';

import { RANK_COLORS, isLeagueName } from '~/utils/constants';

// TODO: Clean up this typing.
type Props = {
  position: TeamGame & {
    team: Team & {
      league: League;
      user: User | null;
    };
    startingPlayers: Player[];
  };
  rank: number;
};

export default function LeaderboardRow({ position, rank }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const handleAccordion = () => {
    setShowDetails(prevState => !prevState);
  };

  const positionColors: Record<string, string> = {
    qb: 'border-qb',
    rb: 'border-rb',
    wr: 'border-wr',
    te: 'border-te',
    def: 'border-def',
    empty: 'border-gray-500',
  };

  const leagueName = position.team.league.name.toLocaleLowerCase();

  return (
    <>
      <tr
        key={position.teamId}
        className={clsx(rank % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800', 'p-2')}
      >
        <td className='pl-1'>
          <div
            className={clsx(
              isLeagueName(leagueName) && RANK_COLORS[leagueName],
              'mx-auto w-8 h-8 flex justify-center items-center font-bold text-sm',
            )}
          >
            {rank}
          </div>
        </td>
        <td className='flex items-center gap-3'>
          {position.team.user?.discordName || 'Missing user'}{' '}
          {showDetails ? (
            <ChevronUpIcon
              width={20}
              height={20}
              onClick={handleAccordion}
              className='cursor-pointer'
              aria-label='Hide Details'
            />
          ) : (
            <ChevronDownIcon
              width={20}
              height={20}
              onClick={handleAccordion}
              className='cursor-pointer'
              aria-label='Show Details'
            />
          )}
        </td>
        <td>{position.pointsScored?.toFixed(2)}</td>
      </tr>
      {showDetails && (
        <tr className='border-b-1 bg-gray-800 '>
          <td colSpan={3}>
            <div className='grid md:grid-cols-2 lg:grid-cols-3 px-4'>
              {position.starters.map((starterId, index) => {
                const player = position.startingPlayers.find(
                  starter => starter.sleeperId === starterId,
                );

                const playerPosition =
                  player?.position?.toLocaleLowerCase() || 'empty';

                return (
                  <div
                    className={clsx(
                      positionColors[playerPosition],
                      'mb-1 border-l-8 pl-4',
                    )}
                    key={starterId}
                  >
                    <div className='flex items-baseline gap-2'>
                      <div>{player?.fullName || 'Empty'}</div>
                      <div className='text-sm italic text-gray-400'>
                        {position.startingPlayerPoints[index].toFixed(2)} pts
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
