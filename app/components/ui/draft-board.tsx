import type { ReactNode } from 'react';
import { cn } from '~/utils';

/** The surface the board sits on, so the pinned round column matches it. */
const PINNED =
  'sticky left-0 z-10 bg-[oklch(var(--surface,var(--background)))]';

type Props<Column> = {
  columns: Column[];
  rounds: number;
  columnKey: (column: Column) => string | number;
  renderHeader: (column: Column) => ReactNode;
  /** The cell for a column's pick in a round, or null to leave it empty. */
  renderCell: (column: Column, round: number) => ReactNode;
  /** Narrowest a column gets before the board scrolls sideways instead. */
  minColumnWidth?: string;
};

/**
 * A draft board: one column per team, one row per round.
 *
 * Laid out as a single grid rather than a stack of columns, so a row's cells
 * always line up even when a column is missing picks. Wider than the screen,
 * it scrolls inside its own container with the round numbers pinned.
 */
export function DraftBoard<Column>({
  columns,
  rounds,
  columnKey,
  renderHeader,
  renderCell,
  minColumnWidth = '6.5rem',
}: Props<Column>) {
  const roundNumbers = Array.from({ length: rounds }, (_, index) => index + 1);

  return (
    <div className='not-prose overflow-x-auto'>
      <div
        className='grid gap-1 text-sm'
        style={{
          gridTemplateColumns: `auto repeat(${columns.length}, minmax(${minColumnWidth}, 1fr))`,
        }}
      >
        <div className={PINNED}>
          <span className='sr-only'>Round</span>
        </div>
        {columns.map(column => (
          <div key={columnKey(column)} className='min-w-0'>
            {renderHeader(column)}
          </div>
        ))}

        {roundNumbers.map(round => (
          <RoundRow
            key={round}
            round={round}
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

function RoundRow({ round, cells }: { round: number; cells: ReactNode[] }) {
  return (
    <>
      <div
        className={cn(
          PINNED,
          'flex items-center justify-center pr-2 font-semibold tabular-nums text-muted-foreground',
        )}
      >
        {round}
      </div>
      {cells}
    </>
  );
}

function EmptyCell() {
  return (
    <div
      aria-hidden='true'
      className='h-16 border border-dashed border-border'
    />
  );
}

/** The top of a board's column: the team, and a line under it. */
export function DraftBoardHeader({
  title,
  subtitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className='flex h-14 flex-col justify-between bg-secondary p-1.5 text-center text-secondary-foreground'>
      <div className='truncate font-semibold'>{title}</div>
      {subtitle && (
        <div className='truncate text-sm tabular-nums text-muted-foreground'>
          {subtitle}
        </div>
      )}
    </div>
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
  /** Top right, small and muted: usually the pick number. */
  corner?: ReactNode;
  /** Bottom right: a score. */
  trailing?: ReactNode;
  /** Background classes, such as a position's tint from positionTint. */
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
      className={cn(
        'relative flex h-16 gap-1 overflow-hidden p-1 text-foreground transition-opacity duration-fast',
        indicator && 'pl-2',
        tone,
        dimmed && 'opacity-30',
        highlighted && 'outline outline-2 -outline-offset-2 outline-foreground',
      )}
    >
      <div className='flex min-w-0 flex-1 flex-col justify-between'>
        <div className='line-clamp-2 font-bold leading-tight'>{title}</div>
        {subtitle && <div className='truncate text-sm'>{subtitle}</div>}
      </div>
      <div
        className={cn(
          'flex flex-col items-end text-right',
          corner ? 'justify-between' : 'justify-end',
        )}
      >
        {corner && (
          <div className='text-sm tabular-nums text-muted-foreground'>
            {corner}
          </div>
        )}
        {trailing}
      </div>
      {indicator && (
        <div
          aria-hidden='true'
          className={cn('absolute inset-y-0 left-0 w-1', indicator)}
        />
      )}
    </div>
  );
}
