import { ChevronDownIcon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';
import { EmptyState } from '~/components/ui/empty-state';
import { FOCUS_RING } from '~/components/ui/styles';
import { LeagueMark } from '~/components/ui/swatch';
import { Table } from '~/components/ui/table';
import { cn } from '~/utils';

export type LeaderboardEntry = {
  /** Stable key, and the identity used to track which rows are expanded. */
  id: string;
  rank: number;
  /** The name cell. A ReactNode so callers can link it. */
  name: ReactNode;
  /** The entry's league, shown in its own column when any entry has one. */
  league?: string;
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
  rankHeading?: string;
  emptyMessage?: string;
};

/**
 * The one leaderboard table.
 *
 * The league season, league weekly, and D12 boards each used to hand-roll this
 * markup, which is how they ended up disagreeing about tie handling, rank
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
    return <EmptyState title={emptyMessage} />;
  }

  const withLeague = entries.some(entry => entry.league);
  const headers = [
    rankHeading,
    nameHeading,
    ...(withLeague ? ['League'] : []),
    ...valueHeadings,
  ];
  const firstValue = headers.length - valueHeadings.length;

  return (
    <Table
      headers={headers}
      numericColumns={[
        0,
        ...valueHeadings.map((_, index) => firstValue + index),
      ]}
    >
      {entries.map(entry => {
        const isExpanded = expandedIds.has(entry.id);

        return (
          <Fragment key={entry.id}>
            <tr>
              <td className='text-right text-muted-foreground'>{entry.rank}</td>
              <td>
                <div className='flex items-center gap-2'>
                  {entry.name}
                  {entry.details && (
                    <button
                      type='button'
                      onClick={() => toggle(entry.id)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Hide details' : 'Show details'}
                      className={cn(
                        'inline-flex size-8 items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground',
                        FOCUS_RING,
                      )}
                    >
                      <ChevronDownIcon
                        aria-hidden
                        className={cn(
                          'size-4 transition-transform duration-fast',
                          isExpanded && 'rotate-180',
                        )}
                      />
                    </button>
                  )}
                </div>
              </td>
              {withLeague && (
                <td>{entry.league && <LeagueMark name={entry.league} />}</td>
              )}
              {entry.values.map((value, valueIndex) => (
                <td
                  key={valueHeadings[valueIndex] ?? valueIndex}
                  className='text-right'
                >
                  {value}
                </td>
              ))}
            </tr>
            {entry.details && isExpanded && (
              <tr className='bg-muted'>
                <td />
                <td colSpan={headers.length - 1}>{entry.details}</td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </Table>
  );
}
