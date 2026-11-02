import { PositionMark } from '~/components/ui/swatch';
import type { Player } from '~/models/players.server';

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
    <ul className='grid gap-x-6 gap-y-1 md:grid-cols-2 lg:grid-cols-3'>
      {starters.map((starterId, index) => {
        const player = startingPlayers.find(
          starter => starter.sleeperId === starterId,
        );

        return (
          <li
            className='flex items-baseline gap-2'
            key={`${starterId}-${index}`}
          >
            <PositionMark position={player?.position ?? null} />
            <span className='min-w-0 flex-1 truncate'>
              {player?.fullName || 'Empty'}
            </span>
            <span className='text-sm tabular-nums text-muted-foreground'>
              {(startingPlayerPoints[index] ?? 0).toFixed(2)} pts
            </span>
          </li>
        );
      })}
    </ul>
  );
}
