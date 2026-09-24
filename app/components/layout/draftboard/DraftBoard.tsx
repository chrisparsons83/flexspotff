import clsx from 'clsx';
import type { ReactNode } from 'react';

type Props<Column> = {
  columns: Column[];
  rounds: number;
  columnKey: (column: Column) => string | number;
  renderHeader: (column: Column) => ReactNode;
  /** The cell for a column's pick in a round, or null to leave it empty. */
  renderCell: (column: Column, round: number) => ReactNode;
  /** Round labels point the way a snake draft runs through that round. */
  snake?: boolean;
  /** Narrowest a column gets before the board scrolls sideways instead. */
  minColumnWidth?: string;
};

/**
 * A draft board: one column per team, one row per round.
 *
 * Laid out as a single grid rather than a stack of columns, so a row's cells
 * always line up even when a column is missing picks. Wider than the screen,
 * it scrolls inside its own container with the round labels pinned.
 */
export default function DraftBoard<Column>({
  columns,
  rounds,
  columnKey,
  renderHeader,
  renderCell,
  snake = false,
  minColumnWidth = '6.5rem',
}: Props<Column>) {
  const roundNumbers = Array.from({ length: rounds }, (_, index) => index + 1);

  return (
    <div className='not-prose overflow-x-auto'>
      <div
        className='grid gap-1 text-xs'
        style={{
          gridTemplateColumns: `auto repeat(${columns.length}, minmax(${minColumnWidth}, 1fr))`,
        }}
      >
        <div className='sticky left-0 z-10 bg-slate-800' />
        {columns.map(column => (
          <div key={columnKey(column)} className='min-w-0'>
            {renderHeader(column)}
          </div>
        ))}

        {roundNumbers.map(round => (
          <RoundRow
            key={round}
            round={round}
            snake={snake}
            cells={columns.map(column => (
              <div key={columnKey(column)} className='min-w-0'>
                {renderCell(column, round) ?? <EmptyCell />}
              </div>
            ))}
          />
        ))}
      </div>
    </div>
  );
}

function RoundRow({
  round,
  snake,
  cells,
}: {
  round: number;
  snake: boolean;
  cells: ReactNode[];
}) {
  return (
    <>
      <div className='sticky left-0 z-10 flex flex-col items-center justify-center bg-slate-800 pr-1 text-slate-400'>
        <span className='font-semibold tabular-nums'>{round}</span>
        {snake && (
          <span aria-hidden='true' className='text-[0.65rem] text-slate-500'>
            {round % 2 === 1 ? '→' : '←'}
          </span>
        )}
      </div>
      {cells}
    </>
  );
}

function EmptyCell() {
  return (
    <div
      aria-hidden='true'
      className='h-16 rounded border border-dashed border-slate-700'
    />
  );
}

/**
 * One pick. Callers decide what the words and colours mean; this keeps every
 * board's cells the same size and in the same places.
 */
export function DraftBoardCell({
  title,
  subtitle,
  corner,
  trailing,
  tone,
  indicator,
  tooltip,
  dimmed = false,
  highlighted = false,
  onMouseEnter,
  onMouseLeave,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Top right, small and muted - usually the pick number. */
  corner?: ReactNode;
  /** Bottom right - a score, an emoji. */
  trailing?: ReactNode;
  /** Background classes. */
  tone: string;
  /**
   * Background class for a strip down the left edge, for a second measure
   * when the background is already being used for something else.
   */
  indicator?: string;
  tooltip?: string;
  dimmed?: boolean;
  highlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <div
      title={tooltip}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={clsx(
        'relative flex h-16 gap-1 overflow-hidden rounded p-1 transition-opacity',
        indicator && 'pl-1.5',
        tone,
        dimmed && 'opacity-30',
        highlighted && 'ring-2 ring-white/80',
      )}
    >
      <div className='flex min-w-0 flex-1 flex-col justify-between'>
        <div className='line-clamp-2 font-bold leading-tight text-white'>
          {title}
        </div>
        {subtitle && <div className='truncate'>{subtitle}</div>}
      </div>
      <div
        className={clsx(
          'flex flex-col items-end text-right',
          corner ? 'justify-between' : 'justify-end',
        )}
      >
        {corner && (
          <div className='text-[0.65rem] tabular-nums text-white/70'>
            {corner}
          </div>
        )}
        {trailing}
      </div>
      {indicator && (
        <div
          aria-hidden='true'
          className={clsx('absolute inset-y-0 left-0 w-0.5', indicator)}
        />
      )}
    </div>
  );
}
