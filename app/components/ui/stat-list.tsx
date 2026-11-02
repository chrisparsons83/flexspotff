import type { ReactNode } from 'react';
import { cn } from '~/utils';

/**
 * A few headline figures set on the grid: the name small and muted, the
 * number large under it. No tile behind each one; space separates them.
 * For a handful of figures at the top of a page, not in place of a table.
 */
export function StatList({
  stats,
  className = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6',
}: {
  stats: { label: string; value: ReactNode }[];
  /** The columns; six across from md by default. */
  className?: string;
}) {
  return (
    <dl className={cn('m-0 grid gap-x-6 gap-y-4', className)}>
      {stats.map(stat => (
        <div key={stat.label}>
          <dt className='text-sm text-muted-foreground'>{stat.label}</dt>
          <dd className='m-0 mt-1 text-xl font-extrabold tabular-nums'>
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
