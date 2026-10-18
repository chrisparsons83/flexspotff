import { LockClosedIcon } from '@radix-ui/react-icons';
import clsx from 'clsx';
import type { WeekSummary } from '~/routes/games.dfs-survivor.entries._index';

/** This week, underlined rather than marked with a dot. */
const WEEK_CURRENT = 'underline decoration-2 underline-offset-2';

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
              'border px-1 py-1 text-center leading-tight transition-colors',
              isSelected
                ? 'border-primary-edge bg-primary text-primary-foreground'
                : isDisabled
                ? 'cursor-not-allowed border-border bg-card text-muted-foreground'
                : 'border-border bg-card text-foreground hover:bg-secondary',
            )}
          >
            <div className='flex items-center justify-center gap-0.5 text-sm font-semibold'>
              <span className={isCurrent ? WEEK_CURRENT : undefined}>
                {week.week}
              </span>
              {isCurrent && <span className='sr-only'>, this week</span>}
              {week.isLocked && !week.isScored && (
                <LockClosedIcon aria-label='Locked' className='size-3' />
              )}
              {isCurrent && <span className='sr-only'>(current week)</span>}
            </div>
            <div
              className={clsx(
                'text-sm tabular-nums',
                week.isScored
                  ? 'text-foreground'
                  : isComplete
                  ? 'text-positive'
                  : 'text-muted-foreground',
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
