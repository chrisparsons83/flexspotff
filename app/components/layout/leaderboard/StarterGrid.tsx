import clsx from 'clsx';
import type { Player } from '~/models/players.server';
import { POSITION_BORDER_COLORS } from '~/utils/constants';

type Props = {
  /** Sleeper player IDs in starting-slot order. '0' marks an empty slot. */
  starters: string[];
  /** The players behind those IDs, in any order. */
  startingPlayers: Player[];
  /** Points per starting slot, correlated to `starters` by index. */
  startingPlayerPoints: number[];
};

/** The lineup behind a team's weekly score, shown when a row is expanded. */
export default function StarterGrid({
  starters,
  startingPlayers,
  startingPlayerPoints,
}: Props) {
  return (
    <div className='grid md:grid-cols-2 lg:grid-cols-3 px-4'>
      {starters.map((starterId, index) => {
        const player = startingPlayers.find(
          starter => starter.sleeperId === starterId,
        );

        const playerPosition = player?.position?.toLocaleLowerCase() || 'empty';

        return (
          <div
            className={clsx(
              POSITION_BORDER_COLORS[playerPosition],
              'mb-1 border-l-8 pl-4',
            )}
            key={`${starterId}-${index}`}
          >
            <div className='flex items-baseline gap-2'>
              <div>{player?.fullName || 'Empty'}</div>
              <div className='text-sm italic text-gray-400'>
                {(startingPlayerPoints[index] ?? 0).toFixed(2)} pts
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
