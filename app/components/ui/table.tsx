import { FOCUS_RING, LABEL } from './styles';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
} from '@radix-ui/react-icons';
import type { ReactElement, ReactNode } from 'react';
import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useState,
} from 'react';
import { cn } from '~/utils';

export type SortDirection = 'asc' | 'desc';

export type TableSort<K extends string = string> = {
  key: K;
  direction: SortDirection;
  /** Sorts by this key; the same key again turns the order over. */
  onSort(key: K): void;
};

type SortValue = number | string | null | undefined;

/**
 * Sorts rows by whichever column the reader picked. Each key reads a value
 * off a row; empty values go last whichever way the order runs. A new column
 * starts in its own default direction: numbers high to low, text A to Z.
 */
export function useTableSort<T, K extends string>(
  rows: T[],
  accessors: Record<K, (row: T) => SortValue>,
  initial: { key: NoInfer<K>; direction?: SortDirection },
) {
  const [key, setKey] = useState<K>(initial.key);
  const [direction, setDirection] = useState<SortDirection>(
    initial.direction ?? 'desc',
  );

  // Sorted every render rather than memoised: accessors are usually written
  // inline and can read state of their own, such as a chosen season.
  const read = accessors[key];
  const sign = direction === 'asc' ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    const x = read(a);
    const y = read(b);
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
    return (
      sign *
      (typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y)))
    );
  });

  const onSort = (next: K) => {
    if (next === key) {
      setDirection(current => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    const sample = rows.map(accessors[next]).find(value => value != null);
    setKey(next);
    setDirection(typeof sample === 'number' ? 'desc' : 'asc');
  };

  return { rows: sorted, sort: { key, direction, onSort } as TableSort<K> };
}

type Props = {
  headers: string[];
  /** Right-align numeric columns by index. */
  numericColumns?: number[];
  /** Says what the table is, for screen readers. */
  caption?: string;
  /**
   * The column headers stay at the top of the screen while the table
   * scrolls past, from desktop width. Below it a wide table scrolls
   * sideways inside itself, which no sticky header can survive.
   */
  stickyHeader?: boolean;
  /**
   * Which columns, by index, sort when their header is pressed, and by
   * which key. Pass `sort` from useTableSort with it.
   */
  sortKeys?: Partial<Record<number, string>>;
  sort?: TableSort;
  /** A totals row, set apart from the body and pinned to the bottom. */
  footer?: ReactNode;
  /**
   * The columns, by index, that stay in the row below desktop width. The
   * rest fold into a panel each row opens with its own button, so a wide
   * table fits the screen instead of scrolling sideways. Leave it out to show
   * every column.
   */
  primaryColumns?: number[];
  /**
   * What to show below desktop width in place of the table: a list of
   * MobileCards, for a log whose rows read better as two short lines than
   * as a row of cells.
   */
  mobileCards?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * Hides a column's cells below desktop width, where the wide tables stop
 * fitting - on a tablet as well as a phone. Written out in full, one per column,
 * because Tailwind only builds the classes it finds whole in the source.
 *
 * The selector walks down from the table by child steps, so it never reaches
 * the folded-away cells shown again inside a row's own panel.
 */
// Up to 24 columns, which covers Most Streamed's column per season for a
// decade and more to come.
const HIDE_ON_PHONE: Record<number, string> = {
  2: 'max-lg:[&>table>*>tr>*:nth-child(2)]:hidden',
  3: 'max-lg:[&>table>*>tr>*:nth-child(3)]:hidden',
  4: 'max-lg:[&>table>*>tr>*:nth-child(4)]:hidden',
  5: 'max-lg:[&>table>*>tr>*:nth-child(5)]:hidden',
  6: 'max-lg:[&>table>*>tr>*:nth-child(6)]:hidden',
  7: 'max-lg:[&>table>*>tr>*:nth-child(7)]:hidden',
  8: 'max-lg:[&>table>*>tr>*:nth-child(8)]:hidden',
  9: 'max-lg:[&>table>*>tr>*:nth-child(9)]:hidden',
  10: 'max-lg:[&>table>*>tr>*:nth-child(10)]:hidden',
  11: 'max-lg:[&>table>*>tr>*:nth-child(11)]:hidden',
  12: 'max-lg:[&>table>*>tr>*:nth-child(12)]:hidden',
  13: 'max-lg:[&>table>*>tr>*:nth-child(13)]:hidden',
  14: 'max-lg:[&>table>*>tr>*:nth-child(14)]:hidden',
  15: 'max-lg:[&>table>*>tr>*:nth-child(15)]:hidden',
  16: 'max-lg:[&>table>*>tr>*:nth-child(16)]:hidden',
  17: 'max-lg:[&>table>*>tr>*:nth-child(17)]:hidden',
  18: 'max-lg:[&>table>*>tr>*:nth-child(18)]:hidden',
  19: 'max-lg:[&>table>*>tr>*:nth-child(19)]:hidden',
  20: 'max-lg:[&>table>*>tr>*:nth-child(20)]:hidden',
  21: 'max-lg:[&>table>*>tr>*:nth-child(21)]:hidden',
  22: 'max-lg:[&>table>*>tr>*:nth-child(22)]:hidden',
  23: 'max-lg:[&>table>*>tr>*:nth-child(23)]:hidden',
  24: 'max-lg:[&>table>*>tr>*:nth-child(24)]:hidden',
};

/**
 * Children with any fragments opened up, so each row and cell is its own
 * item. Each keeps a key prefixed with the fragments it came out of, since
 * two fragments' children can share keys that are only unique within them.
 */
function flatten(children: ReactNode, prefix = ''): ReactNode[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [child];
    if (child.type === Fragment) {
      return flatten(child.props.children, `${prefix}${child.key ?? ''}/`);
    }
    return [cloneElement(child, { key: `${prefix}${child.key ?? ''}` })];
  });
}

/**
 * The table's own cells take their spacing, rules and type from the table,
 * so every table on the site reads alike whatever its rows bring. Only its
 * own: a table inside a cell keeps its own spacing. Rows are set apart by a
 * rule rather than stripes; numbers line up on equal-width digits.
 */
const CELLS = cn(
  '[&>table>*>tr>td]:px-3 [&>table>*>tr>td]:py-2.5 [&>table>*>tr>th]:px-3 [&>table>*>tr>th]:py-2.5',
  '[&>table>tbody>tr]:border-b [&>table>tbody>tr]:border-border',
  // The signed-in member's own row, wherever they appear (ProfileLink marks
  // their name).
  '[&>table>tbody>tr:has([data-me])]:bg-primary/10',
  '[&>table>tfoot]:border-t-2 [&>table>tfoot]:border-border [&>table>tfoot]:font-semibold',
);

/**
 * The table every page shares.
 *
 * On a phone a wide table either keeps its key columns and folds the rest
 * into each row (`primaryColumns`), or gives way to a list of cards
 * (`mobileCards`). A table with neither scrolls inside its own container
 * rather than the page.
 */
export function Table({
  headers,
  numericColumns = [],
  caption,
  stickyHeader = false,
  sortKeys = {},
  sort,
  footer,
  primaryColumns,
  mobileCards,
  className,
  children,
}: Props) {
  const numeric = new Set(numericColumns);
  const primary = primaryColumns && new Set([0, ...primaryColumns]);
  const folded = primary
    ? headers.map((_, index) => index).filter(index => !primary.has(index))
    : [];
  const folds = folded.length > 0;

  // The footer folds as well as the body, so a totals row's hidden cells
  // can still be opened on a phone.
  const foldRows = (rows: ReactNode) =>
    flatten(rows).map((row, index) =>
      isValidElement(row) && row.type === 'tr' ? (
        <FoldingRow
          key={row.key ?? index}
          row={row as ReactElement<{ children?: ReactNode }>}
          headers={headers}
          folded={folded}
          span={headers.length - folded.length + 1}
        />
      ) : (
        row
      ),
    );

  return (
    <>
      <div
        className={cn(
          // Relative, so screen-reader-only text inside is placed within
          // the scroller rather than stretching the page on a phone.
          'not-prose relative max-lg:overflow-x-auto',
          // A well a little darker than what the table sits on, with the
          // header row raised back up to the surface. With no well, both
          // are see-through.
          'bg-[color-mix(in_oklab,oklch(var(--surface,var(--background))),var(--well-mix))]',
          !stickyHeader && 'overflow-x-auto',
          CELLS,
          folded.map(index => HIDE_ON_PHONE[index + 1]),
          mobileCards && 'max-lg:hidden',
          className,
        )}
      >
        <table className='w-full border-collapse text-left text-base tabular-nums'>
          {caption && <caption className='sr-only'>{caption}</caption>}
          <thead>
            <tr
              className={cn(
                'border-b border-border bg-[color-mix(in_oklab,oklch(var(--surface,var(--background))),var(--well-head-mix))] text-sm text-muted-foreground',
                LABEL,
              )}
            >
              {headers.map((header, index) => {
                const sortKey = sortKeys[index];
                const sorted = sort && sortKey && sort.key === sortKey;
                return (
                  <th
                    key={`${header}-${index}`}
                    scope='col'
                    aria-sort={
                      sorted
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    className={cn(
                      'whitespace-nowrap font-semibold',
                      numeric.has(index) && 'text-right',
                      // The surface the table sits on, which a Card or a
                      // section panel sets, so the pinned row matches it.
                      stickyHeader &&
                        'lg:sticky lg:top-0 lg:z-10 lg:bg-[oklch(var(--surface,var(--background)))]',
                    )}
                  >
                    {sort && sortKey ? (
                      <SortButton
                        sorted={sorted ? sort.direction : null}
                        onClick={() => sort.onSort(sortKey)}
                        alignEnd={numeric.has(index)}
                      >
                        {header}
                      </SortButton>
                    ) : (
                      header
                    )}
                  </th>
                );
              })}
              {folds && (
                <th scope='col' className='w-10 lg:hidden'>
                  <span className='sr-only'>More</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>{folds ? foldRows(children) : children}</tbody>
          {footer && <tfoot>{folds ? foldRows(footer) : footer}</tfoot>}
        </table>
      </div>
      {mobileCards && <div className='not-prose lg:hidden'>{mobileCards}</div>}
    </>
  );
}

/**
 * A column header that sorts. The arrow shows the order it is sorted in; an
 * unsorted column shows none, so the header reads as a plain label until
 * it is used.
 */
function SortButton({
  sorted,
  onClick,
  alignEnd,
  children,
}: {
  sorted: SortDirection | null;
  onClick: () => void;
  alignEnd: boolean;
  children: ReactNode;
}) {
  const Arrow = sorted === 'asc' ? ArrowUpIcon : ArrowDownIcon;
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 font-semibold hover:text-foreground',
        sorted && 'text-foreground',
        alignEnd && 'flex-row-reverse',
        FOCUS_RING,
      )}
    >
      {children}
      <Arrow
        aria-hidden
        className={cn('size-3.5 shrink-0', !sorted && 'invisible')}
      />
    </button>
  );
}

/**
 * A row whose folded-away cells open in a panel under it on a phone. The
 * cells are shown again as they are, each beside its column's name, in a
 * small table of their own - they are table cells, so they need one.
 */
function FoldingRow({
  row,
  headers,
  folded,
  span,
}: {
  row: ReactElement<{ children?: ReactNode }>;
  headers: string[];
  folded: number[];
  span: number;
}) {
  const [open, setOpen] = useState(false);
  const cells = flatten(row.props.children);
  // An empty placeholder cell, like a totals row's blank under a rank, has
  // nothing worth a line in the panel.
  const hidden = folded.filter(index => {
    const cell = cells[index];
    if (cell === undefined) return false;
    return !(
      isValidElement<{ children?: ReactNode }>(cell) &&
      typeof cell.type === 'string' &&
      cell.props.children == null
    );
  });

  // A row with fewer cells than columns, like a divider, has nothing to fold.
  if (hidden.length === 0) return row;

  return (
    <>
      {cloneElement(
        row,
        {},
        ...cells,
        <td key='fold' className='w-10 !px-1 !py-1 text-right lg:hidden'>
          <button
            type='button'
            aria-expanded={open}
            aria-label={open ? 'Show less' : 'Show more'}
            onClick={() => setOpen(value => !value)}
            className={cn(
              'inline-flex size-8 items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground',
              FOCUS_RING,
            )}
          >
            <ChevronDownIcon
              aria-hidden='true'
              className={cn(
                'size-4 transition-transform duration-fast',
                open && 'rotate-180',
              )}
            />
          </button>
        </td>,
      )}
      {open && (
        <tr className='bg-muted lg:hidden'>
          <td colSpan={span} className='!py-1'>
            <table className='w-full'>
              <tbody>
                {hidden.map(index => (
                  <tr key={index}>
                    <th
                      scope='row'
                      className='w-1/2 py-1 pr-2 text-left text-sm font-semibold text-muted-foreground'
                    >
                      {headers[index]}
                    </th>
                    {cells[index]}
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

/** The phone list a log shows in place of its table. */
export function MobileCards({ children }: { children: ReactNode }) {
  return (
    <ul className='m-0 list-none divide-y divide-border border-y border-border p-0'>
      {children}
    </ul>
  );
}

/**
 * One row of a log as two short lines: what it was on the left, how it went
 * on the right, with anything longer underneath.
 */
export function MobileCard({
  title,
  subtitle,
  value,
  status,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  status?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className='py-3'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div>{title}</div>
          {subtitle && (
            <div className='mt-0.5 text-sm text-muted-foreground'>
              {subtitle}
            </div>
          )}
        </div>
        {(value !== undefined || status) && (
          <div className='shrink-0 text-right'>
            {value !== undefined && (
              <div className='font-semibold tabular-nums'>{value}</div>
            )}
            {status && (
              <div className='mt-1 flex flex-wrap justify-end gap-1'>
                {status}
              </div>
            )}
          </div>
        )}
      </div>
      {children && <div className='mt-2'>{children}</div>}
    </li>
  );
}
