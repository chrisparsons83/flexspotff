import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { FILLS } from '~/components/ui/fills';
import { ProfileLink } from '~/components/ui/profile-link';
import { LeagueMark } from '~/components/ui/swatch';
import { Table } from '~/components/ui/table';
import type { RecordRow } from '~/models/records.server';
import { cn } from '~/utils';

type Props = {
  title: string;
  headers: string[];
  rows: RecordRow[];
};

/**
 * Each row's place, with ties sharing one (1, 2, 2, 4). The second cell is
 * always the record's value, as shown, so rows that show the same value tie.
 */
function competitionRanks(rows: RecordRow[]) {
  return rows.map((row, index) => {
    let first = index;
    while (first > 0 && rows[first - 1]!.cells[1] === row.cells[1]) first--;
    return first + 1;
  });
}

/** Rows a page shows. */
const PAGE_SIZE = 25;

/** The podium: its ranks sit on the medal fills, and a rule closes it off. */
const MEDALS = ['medal-gold', 'medal-silver', 'medal-bronze'] as const;

/**
 * One record's table, a page at a time. Remount it (key it on the record)
 * to start a new record from its first page.
 */
export default function RecordsTable({ title, headers, rows }: Props) {
  const league = headers.indexOf('League');
  const season = headers.indexOf('Year');
  const [page, setPage] = useState(0);
  const pages = Math.ceil(rows.length / PAGE_SIZE);
  const first = page * PAGE_SIZE;
  const ranks = competitionRanks(rows);
  // The rule goes under the podium's last row, however many tie on it.
  const lastOnPodium = ranks.filter(rank => rank <= MEDALS.length).length - 1;
  const shown = rows.slice(first, first + PAGE_SIZE);

  return (
    <>
      <Table
        headers={['Rank', ...headers]}
        numericColumns={[0]}
        caption={title}
      >
        {shown.map((row, index) => {
          const position = first + index;
          const rank = ranks[position]!;
          const medal = MEDALS[rank - 1];
          return (
            <tr
              key={position}
              className={cn(
                medal && 'font-semibold',
                position === lastOnPodium &&
                  '[&>td]:border-b-2 [&>td]:border-b-foreground/40',
              )}
            >
              <td className='text-right text-muted-foreground'>
                {medal ? (
                  <span
                    className={cn(
                      'ml-auto flex size-6 items-center justify-center border text-sm font-bold tabular-nums',
                      FILLS[medal],
                    )}
                  >
                    {rank}
                  </span>
                ) : (
                  rank
                )}
              </td>
              {row.cells.map((cell, i) => (
                <td key={i}>
                  {/* The first cell is always the player. Rows that aggregate
                      several members carry no id and stay plain text. */}
                  {i === 0 && row.playerUserId ? (
                    <ProfileLink userId={row.playerUserId}>{cell}</ProfileLink>
                  ) : i === league && cell ? (
                    <LeagueMark
                      name={String(cell)}
                      year={season >= 0 ? row.cells[season] : undefined}
                    />
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          );
        })}
      </Table>
      {pages > 1 && (
        <nav
          aria-label={`${title} pages`}
          className='mt-4 flex flex-wrap items-center gap-4'
        >
          <Button
            variant='secondary'
            size='sm'
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className='text-sm text-muted-foreground tabular-nums'>
            {first + 1}–{first + shown.length} of {rows.length}
          </span>
          <Button
            variant='secondary'
            size='sm'
            disabled={page === pages - 1}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </>
  );
}
