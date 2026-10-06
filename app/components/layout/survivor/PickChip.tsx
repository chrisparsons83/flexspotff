import clsx from 'clsx';
import type { BoardCell } from '~/libs/survivor/views';

/**
 * One week of a survivor entry: the team picked and how it went. A mark
 * beside the team says the result as well as the colour does, since red and
 * green alone are lost on anyone who cannot tell them apart.
 */
export default function PickChip({ cell }: { cell: BoardCell }) {
  if (cell.kind === 'none') {
    return <span className='text-slate-600'>·</span>;
  }
  if (cell.kind === 'missed') {
    return (
      <span
        title='No pick: out'
        className='relative inline-block w-14 rounded bg-rose-400/15 px-1 py-0.5 text-center text-xs font-semibold text-rose-200'
      >
        <span aria-hidden>✗ none</span>
        <span className='sr-only'>No pick, out</span>
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
      className={clsx(
        'relative inline-block w-14 rounded px-1 py-0.5 text-center text-xs font-semibold tabular-nums',
        cell.result === 'WIN' && 'bg-emerald-400/15 text-emerald-200',
        cell.result === 'LOSS' && 'bg-rose-400/15 text-rose-200',
        cell.result === 'PENDING' && 'bg-amber-400/15 text-amber-200',
      )}
    >
      {cell.team}
      <span aria-hidden className='ml-0.5 opacity-80'>
        {cell.result === 'WIN' ? '✓' : cell.result === 'LOSS' ? '✗' : '…'}
      </span>
      <span className='sr-only'> {label}</span>
    </span>
  );
}
