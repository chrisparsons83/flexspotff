import clsx from 'clsx';
import { useState } from 'react';
import { pts } from '~/components/layout/profile/format';
import { DraftBoard, DraftBoardCell } from '~/components/ui/draft-board';
import { positionTint } from '~/components/ui/fills';
import type {
  D12Board,
  D12BoardPick,
  D12Heat,
} from '~/models/profile/d12Profile';

/**
 * The strip down the left of a board cell: starter points ranked against the
 * rest of the board, from dark to light in the blue value sequence, or red for
 * a pick that has never scored. Blue against red rather than green against
 * red, so it reads the same with red-green colour blindness. The cell itself
 * is coloured by position.
 */
const HEAT_BAR: Record<D12Heat, string | undefined> = {
  5: 'bg-sequence-7',
  4: 'bg-sequence-5',
  3: 'bg-sequence-4',
  2: 'bg-sequence-3',
  1: 'bg-sequence-1',
  bust: 'bg-negative',
  none: undefined,
};

const shortName = (pick: D12BoardPick) =>
  pick.firstName && pick.lastName
    ? `${pick.firstName.charAt(0)}. ${pick.lastName}`
    : pick.lastName ?? pick.sleeperId;

/**
 * A member's D12 drafts from every league at once. They pick from a
 * different slot in each league, so side by side the drafts fill a whole
 * twelve-team board. Hovering a player lights up every time they took him.
 * Shared by the profile's D12 tab and the D12 member page.
 */
export function D12DraftBoard({ board }: { board: D12Board }) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <DraftBoard
      columns={board.columns}
      rounds={board.rounds}
      columnKey={column => column.league?.id ?? `slot-${column.slot}`}
      renderHeader={column => (
        <div
          className={clsx(
            'flex h-12 flex-col justify-between p-1 text-center',
            column.league ? 'bg-background/70' : 'bg-background/30',
          )}
        >
          <div className='flex justify-center gap-1.5'>
            <span className='font-semibold text-foreground'>{column.slot}</span>
            {column.league && (
              <span className='text-muted-foreground'>
                {column.league.shortName}
              </span>
            )}
          </div>
          {column.league ? (
            <div className='tabular-nums text-foreground'>
              {pts(column.teamPoints, 1)}
              <span className='ml-1 text-muted-foreground'>points</span>
            </div>
          ) : (
            <div className='text-muted-foreground'>No picks</div>
          )}
        </div>
      )}
      renderCell={(column, round) => {
        const pick = column.picks.find(p => p.round === round);
        if (!pick) return null;
        return (
          <DraftBoardCell
            title={shortName(pick)}
            subtitle={
              <span className='flex items-center gap-1'>
                <span className='font-semibold text-foreground'>
                  {pick.position ?? '?'}
                </span>
                <span className='text-foreground'>{pick.nflTeam ?? 'FA'}</span>
              </span>
            }
            trailing={
              <span className='font-semibold tabular-nums text-foreground'>
                {pts(pick.points, 1)}
              </span>
            }
            tone={positionTint(pick.position)}
            indicator={HEAT_BAR[pick.heat]}
            tooltip={`${pick.firstName ?? ''} ${pick.lastName ?? ''}, ${
              pick.pickLabel
            } (#${pick.pickNo}) in ${column.league?.name ?? ''}: ${
              pick.points === null
                ? 'no lineups yet'
                : `${pick.points.toFixed(2)} starter points`
            }`}
            highlighted={hovered === pick.sleeperId}
            dimmed={hovered !== null && hovered !== pick.sleeperId}
            onMouseEnter={() => setHovered(pick.sleeperId)}
            onMouseLeave={() => setHovered(null)}
          />
        );
      }}
    />
  );
}

/** What the strip down each pick's left edge means. */
export function D12HeatKey() {
  return (
    <span className='inline-flex flex-wrap items-center gap-x-4 gap-y-1'>
      <span className='inline-flex items-center gap-1.5'>
        <span aria-hidden='true' className='flex h-3 gap-px'>
          {([1, 2, 3, 4, 5] as const).map(level => (
            <span key={level} className={clsx('w-1', HEAT_BAR[level])} />
          ))}
        </span>
        Starter points, fewest to most on the board
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <span aria-hidden='true' className={clsx('h-3 w-1', HEAT_BAR.bust)} />
        Never scored
      </span>
    </span>
  );
}
