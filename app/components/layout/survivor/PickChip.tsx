import type { BoardCell } from '~/libs/survivor/views';
import { cn } from '~/utils';

/**
 * One week of a survivor entry: the team picked and how it went. The result
 * is in the shape as well as the colour, so it reads without telling red from
 * green: a win is bold, a loss struck through, a game not played yet muted.
 */
export default function PickChip({ cell }: { cell: BoardCell }) {
  if (cell.kind === 'none') {
    return (
      <span className='text-muted-foreground'>
        <span aria-hidden>–</span>
        <span className='sr-only'>No entry this week</span>
      </span>
    );
  }
  if (cell.kind === 'missed') {
    return (
      <span
        title='No pick: out'
        className='inline-block w-14 bg-destructive/20 px-1 py-0.5 text-center text-sm text-negative line-through'
      >
        None
        <span className='sr-only'>, no pick, out</span>
      </span>
    );
  }

  const label = {
    WIN: 'Won',
    LOSS: 'Lost',
    PENDING: 'Not played yet',
  }[cell.result];

  return (
    <span
      title={`${cell.team}: ${label}`}
      className={cn(
        'inline-block w-14 px-1 py-0.5 text-center text-sm tabular-nums',
        cell.result === 'WIN' && 'bg-positive/20 font-bold',
        cell.result === 'LOSS' &&
          'bg-destructive/20 text-negative line-through',
        cell.result === 'PENDING' && 'bg-secondary text-muted-foreground',
      )}
    >
      {cell.team}
      <span className='sr-only'>, {label}</span>
    </span>
  );
}
