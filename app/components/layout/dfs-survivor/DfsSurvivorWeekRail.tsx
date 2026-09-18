import clsx from 'clsx';
import type { WeekSummary } from '~/routes/games.dfs-survivor.entries._index';

type Props = {
  weeks: WeekSummary[];
  selectedWeek: number;
  currentNflWeek: number;
  onSelectWeek: (week: number) => void;
  /**
   * Blocks navigation away from the selected week. Switching reseeds the
   * lineup from the server, so leaving with unsaved picks would silently
   * discard them.
   */
  isLocked?: boolean;
  lockedReason?: string;
};

/**
 * The season strip across the top of the entry page. Each chip carries enough
 * state - slots filled, points once scored, a lock once the week is over - to
 * find the week that still needs work without opening any of them.
 */
export default function DfsSurvivorWeekRail({
  weeks,
  selectedWeek,
  currentNflWeek,
  onSelectWeek,
  isLocked = false,
  lockedReason,
}: Props) {
  return (
    // An even grid rather than flex-wrap, so seventeen weeks can't leave two
    // chips orphaned on a second row.
    <nav
      aria-label='Week'
      className='mb-4 grid grid-cols-6 gap-1 sm:grid-cols-9 xl:grid-cols-[repeat(17,minmax(0,1fr))]'
    >
      {weeks.map(week => {
        const isSelected = week.week === selectedWeek;
        const isComplete = week.filledSlots === 11;
        const isCurrent = week.week === currentNflWeek;
        const isDisabled = isLocked && !isSelected;

        return (
          <button
            key={week.week}
            type='button'
            onClick={() => onSelectWeek(week.week)}
            disabled={isDisabled}
            aria-current={isSelected ? 'page' : undefined}
            title={
              isDisabled
                ? lockedReason
                : week.isLocked
                ? `Week ${week.week} is locked`
                : undefined
            }
            data-testid={`week-chip-${week.week}`}
            className={clsx(
              'rounded-md border px-1 py-1 text-center leading-tight transition-colors',
              isSelected
                ? 'border-blue-400 bg-blue-900/70 text-white'
                : isDisabled
                ? 'cursor-not-allowed border-slate-800 bg-slate-800/30 text-slate-600'
                : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800',
            )}
          >
            <div className='flex items-center justify-center gap-0.5 text-xs font-semibold'>
              {isCurrent && (
                <span
                  aria-hidden
                  className='h-1.5 w-1.5 rounded-full bg-blue-400'
                />
              )}
              <span>{week.week}</span>
              {week.isLocked && !week.isScored && (
                <span aria-hidden className='text-[0.6rem] text-slate-500'>
                  🔒
                </span>
              )}
              {isCurrent && <span className='sr-only'>(current week)</span>}
            </div>
            <div
              className={clsx(
                'text-[0.65rem] tabular-nums',
                week.isScored
                  ? 'text-slate-300'
                  : isComplete
                  ? 'text-green-400'
                  : 'text-slate-500',
              )}
            >
              {week.isScored
                ? week.points.toFixed(1)
                : `${week.filledSlots}/11`}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
