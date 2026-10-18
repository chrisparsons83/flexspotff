import type { ReactNode } from 'react';
import { Link } from '~/components/ui/link';
import { cn } from '~/utils';

/** The surface the grid sits on, so the pinned team column matches it. */
const PINNED =
  'sticky left-0 z-10 bg-[oklch(var(--surface,var(--background)))] pr-2';

export type ScoreGridCell = {
  value: ReactNode;
  /** Everything about the week, for hover. */
  title: string;
  /** Background classes, from the grid's key. */
  tone: string;
};

/**
 * Every team's score week by week: a row per team, a column per week, each
 * square toned by how the week went. Wider than the screen, it scrolls
 * sideways with the team names pinned.
 */
export function ScoreGrid<
  Row extends { key: string | number; name: ReactNode },
>({
  rows,
  weeks,
  cell,
  weekHref,
}: {
  rows: Row[];
  weeks: number;
  cell: (row: Row, week: number) => ScoreGridCell | null;
  /** Links each week's heading to its own page. */
  weekHref?: (week: number) => string;
}) {
  const weekNumbers = Array.from({ length: weeks }, (_, i) => i + 1);

  return (
    <div className='overflow-x-auto'>
      <table className='border-separate border-spacing-0.5 text-sm tabular-nums'>
        <thead>
          <tr className='text-muted-foreground'>
            <th className={cn(PINNED, 'text-left font-semibold')}>Team</th>
            {weekNumbers.map(week => (
              <th key={week} className='min-w-[3.25rem] font-semibold'>
                {weekHref ? (
                  <Link to={weekHref(week)} variant='quiet'>
                    {week}
                  </Link>
                ) : (
                  week
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key}>
              <td className={cn(PINNED, 'max-w-[10rem] truncate')}>
                {row.name}
              </td>
              {weekNumbers.map(week => {
                const square = cell(row, week);
                return (
                  <td
                    key={week}
                    title={square?.title}
                    className={cn('px-1 py-1 text-center', square?.tone)}
                  >
                    {square?.value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
