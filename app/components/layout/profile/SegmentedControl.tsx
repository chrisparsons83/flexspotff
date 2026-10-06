import clsx from 'clsx';

/**
 * A row of buttons that picks one option, the way every profile section
 * switches its view - a year, a sort, a league.
 */
export default function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Read by screen readers, e.g. "Season" or "Sort by". */
  label: string;
}) {
  return (
    <div role='group' aria-label={label} className='flex flex-wrap gap-1'>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type='button'
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={clsx(
              'rounded px-2.5 py-1 text-sm',
              selected
                ? 'bg-white font-medium text-slate-900'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
