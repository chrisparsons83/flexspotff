import { FOCUS_RING } from './styles';
import { cn } from '~/utils';

/**
 * A row of buttons that picks one view of a section: a year, a sort, a
 * league. The chosen one is a solid block; the rest sit flat on the
 * secondary surface. Wraps onto a second line rather than scrolling.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Read by screen readers, e.g. "Season" or "Sort by". */
  label: string;
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
            onClick={() => onChange(option.value)}
            className={cn(
              'h-8 px-3 text-sm tabular-nums transition-colors duration-fast',
              selected
                ? 'bg-foreground font-semibold text-background'
                : 'bg-secondary text-secondary-foreground hover:bg-accent',
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
