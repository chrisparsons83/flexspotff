import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/outline';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useState } from 'react';

export type LeaderboardEntry = {
  /** Stable key, and the identity used to track which rows are expanded. */
  id: string;
  rank: number;
  /** The name cell. A ReactNode so callers can link it. */
  name: ReactNode;
  /** Tailwind classes for the rank badge, e.g. a league colour. */
  badgeClassName?: string;
  /** Trailing cells, one per heading in `valueHeadings`. */
  values: ReactNode[];
  /** Rendered in an expandable row beneath. Omit for a non-expandable row. */
  details?: ReactNode;
};

type Props = {
  entries: LeaderboardEntry[];
  /** Headings for the trailing value cells. */
  valueHeadings: string[];
  nameHeading?: string;
  /** Heading over the rank badge. */
  rankHeading?: string;
  emptyMessage?: string;
};

/**
 * The one leaderboard table.
 *
 * The league season, league weekly, and D12 boards each used to hand-roll this
 * markup, which is how they ended up disagreeing about tie handling, rank badge
 * colours, and whether the expand control was reachable by keyboard.
 */
export default function LeaderboardTable({
  entries,
  valueHeadings,
  nameHeading = 'Manager',
  rankHeading = 'Rank',
  emptyMessage = 'No scores recorded yet.',
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (entries.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  const columnCount = 2 + valueHeadings.length;

  return (
    <table>
      <thead>
        <tr>
          <th>{rankHeading}</th>
          <th>{nameHeading}</th>
          {valueHeadings.map(heading => (
            <th key={heading}>{heading}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => {
          const isExpanded = expandedIds.has(entry.id);

          return [
            <tr
              key={entry.id}
              className={clsx(
                index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800',
                'p-2',
              )}
            >
              <td className='pl-1'>
                <div
                  className={clsx(
                    entry.badgeClassName,
                    'mx-auto w-8 h-8 flex justify-center items-center font-bold text-sm',
                  )}
                >
                  {entry.rank}
                </div>
              </td>
              <td>
                <div className='flex items-center gap-3'>
                  {entry.name}
                  {entry.details && (
                    <button
                      type='button'
                      onClick={() => toggle(entry.id)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Hide Details' : 'Show Details'}
                      className='cursor-pointer'
                    >
                      {isExpanded ? (
                        <ChevronUpIcon width={20} height={20} />
                      ) : (
                        <ChevronDownIcon width={20} height={20} />
                      )}
                    </button>
                  )}
                </div>
              </td>
              {entry.values.map((value, valueIndex) => (
                <td key={valueHeadings[valueIndex] ?? valueIndex}>{value}</td>
              ))}
            </tr>,
            entry.details && isExpanded ? (
              <tr key={`${entry.id}-details`} className='border-b bg-gray-800'>
                <td></td>
                <td colSpan={columnCount - 1}>{entry.details}</td>
              </tr>
            ) : null,
          ];
        })}
      </tbody>
    </table>
  );
}
