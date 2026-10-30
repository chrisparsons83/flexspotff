import { FOCUS_RING } from './styles';
import { cn } from '~/utils';

/**
 * A row of buttons that picks one of a few: a year, a sort, a league, a
 * pick. The chosen one is marked as the current tab is, with the accent bar;
 * the rest sit flat on the secondary surface. Wraps onto a second line
 * rather than scrolling.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = 'sm',
  disabled = false,
  className,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Read by screen readers, e.g. "Season" or "Sort by". */
  label: string;
  /** md for a choice made by tapping, such as a pick, rather than a view. */
  size?: 'sm' | 'md';
  /** Shows the choice but no longer takes a new one, as a locked pick. */
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role='group'
      aria-label={label}
      className={cn('flex flex-wrap gap-1', className)}
    >
      {options.map(option => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type='button'
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'border px-3 tabular-nums transition-colors duration-fast disabled:cursor-not-allowed',
              // md wraps a long label onto two lines on a phone rather than
              // spilling out of its segment.
              size === 'md'
                ? 'min-h-10 py-1 text-sm leading-tight sm:text-base'
                : 'h-8 text-sm',
              // Chosen the way the current tab is: the tab surface with the
              // accent bar along its foot.
              selected
                ? 'border-tab-edge bg-tab bg-accent-gradient bg-[length:100%_var(--tab-bar)] bg-bottom bg-no-repeat font-semibold text-tab-foreground [background-origin:border-box]'
                : 'border-transparent bg-secondary text-secondary-foreground enabled:hover:bg-accent disabled:text-muted-foreground',
              FOCUS_RING,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Year buttons plus All, for narrowing a log to one season. `showAll={false}`
 * drops All for views that only make sense one season at a time. Logs open on
 * the latest season, so pass the newest year first.
 */
export function YearFilter({
  years,
  value,
  onChange,
  showAll = true,
}: {
  years: number[];
  value: number | 'all';
  onChange: (value: number | 'all') => void;
  showAll?: boolean;
}) {
  return (
    <SegmentedControl<number | 'all'>
      label='Season'
      value={value}
      onChange={onChange}
      options={[
        ...years.map(year => ({ value: year, label: String(year) })),
        ...(showAll ? [{ value: 'all' as const, label: 'All' }] : []),
      ]}
    />
  );
}
