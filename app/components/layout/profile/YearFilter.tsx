import clsx from 'clsx';

/**
 * Year buttons plus "All", for narrowing a log to one season. `showAll={false}`
 * drops "All" for views that only make sense one season at a time.
 */
export default function YearFilter({
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
    <div className='flex flex-wrap gap-1'>
      {[...years, ...(showAll ? ['all' as const] : [])].map(option => (
        <button
          key={option}
          type='button'
          onClick={() => onChange(option)}
          className={clsx(
            'rounded px-2.5 py-1 text-sm',
            value === option
              ? 'bg-white font-medium text-slate-900'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
          )}
        >
          {option === 'all' ? 'All' : option}
        </button>
      ))}
    </div>
  );
}
