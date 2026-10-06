import clsx from 'clsx';

export type BarKeyEntry = { count: number; label: string; tone: string };

/**
 * The counts under a split bar, each beside a piece of the bar in its colour.
 * Every card with a bar has a row like this under it, which is also what keeps
 * their small stats level - so it is set on the same 16px line as the labels
 * under a LabelledRange.
 */
export default function BarKey({ entries }: { entries: BarKeyEntry[] }) {
  return (
    <div className='mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[0.65rem] leading-4 text-slate-400'>
      {entries.map(({ count, label, tone }) => (
        <span key={label} className='inline-flex items-center gap-1'>
          <span
            aria-hidden='true'
            className={clsx('inline-block h-1.5 w-3 rounded-full', tone)}
          />
          <span className='font-semibold tabular-nums text-slate-200'>
            {count}
          </span>
          {label}
        </span>
      ))}
    </div>
  );
}

/** A bar split into parts in proportion, with its BarKey underneath. */
export function KeyedBar({ entries }: { entries: BarKeyEntry[] }) {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <>
      <div
        aria-hidden='true'
        className='flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-700'
      >
        {total > 0 &&
          entries
            .filter(entry => entry.count > 0)
            .map(entry => (
              <div
                key={entry.label}
                className={entry.tone}
                style={{ width: `${(entry.count / total) * 100}%` }}
              />
            ))}
      </div>
      <BarKey entries={entries} />
    </>
  );
}
