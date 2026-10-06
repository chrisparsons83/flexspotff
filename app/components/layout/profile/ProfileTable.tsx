import { ChevronDownIcon } from '@heroicons/react/solid';
import clsx from 'clsx';
import type { ReactElement, ReactNode } from 'react';
import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useState,
} from 'react';

type Props = {
  headers: string[];
  /** Right-align numeric columns by index. */
  numericColumns?: number[];
  /** A totals row, set apart from the body and pinned to the bottom. */
  footer?: ReactNode;
  /**
   * The columns, by index, that stay in the row on a phone. The rest fold
   * into a panel each row opens with its own button, so a wide table fits the
   * screen instead of scrolling sideways. Leave it out to show every column.
   */
  primaryColumns?: number[];
  /**
   * What to show on a phone in place of the table - a list of MobileCards,
   * for a log whose rows read better as two short lines than as a row of
   * cells.
   */
  mobileCards?: ReactNode;
  children: ReactNode;
};

/**
 * Hides a column's cells on a phone. Written out in full, one per column,
 * because Tailwind only builds the classes it finds whole in the source.
 *
 * The selector walks down from the table by child steps, so it never reaches
 * the folded-away cells shown again inside a row's own panel.
 */
const HIDE_ON_PHONE: Record<number, string> = {
  2: 'max-sm:[&>table>*>tr>*:nth-child(2)]:hidden',
  3: 'max-sm:[&>table>*>tr>*:nth-child(3)]:hidden',
  4: 'max-sm:[&>table>*>tr>*:nth-child(4)]:hidden',
  5: 'max-sm:[&>table>*>tr>*:nth-child(5)]:hidden',
  6: 'max-sm:[&>table>*>tr>*:nth-child(6)]:hidden',
  7: 'max-sm:[&>table>*>tr>*:nth-child(7)]:hidden',
  8: 'max-sm:[&>table>*>tr>*:nth-child(8)]:hidden',
  9: 'max-sm:[&>table>*>tr>*:nth-child(9)]:hidden',
  10: 'max-sm:[&>table>*>tr>*:nth-child(10)]:hidden',
  11: 'max-sm:[&>table>*>tr>*:nth-child(11)]:hidden',
  12: 'max-sm:[&>table>*>tr>*:nth-child(12)]:hidden',
  13: 'max-sm:[&>table>*>tr>*:nth-child(13)]:hidden',
  14: 'max-sm:[&>table>*>tr>*:nth-child(14)]:hidden',
  15: 'max-sm:[&>table>*>tr>*:nth-child(15)]:hidden',
  16: 'max-sm:[&>table>*>tr>*:nth-child(16)]:hidden',
};

/** Children with any fragments opened up, so each row and cell is its own item. */
function flatten(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap(child =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flatten(child.props.children)
      : [child],
  );
}

/**
 * The table shell every profile table shares, so the tabs look alike.
 *
 * On a phone a wide table either keeps its key columns and folds the rest
 * into each row (`primaryColumns`), or gives way to a list of cards
 * (`mobileCards`). A table with neither scrolls inside its own container
 * rather than the page.
 */
export default function ProfileTable({
  headers,
  numericColumns = [],
  footer,
  primaryColumns,
  mobileCards,
  children,
}: Props) {
  const numeric = new Set(numericColumns);
  const primary = primaryColumns && new Set([0, ...primaryColumns]);
  const folded = primary
    ? headers.map((_, index) => index).filter(index => !primary.has(index))
    : [];
  const folds = folded.length > 0;

  return (
    <>
      <div
        className={clsx(
          'not-prose overflow-x-auto',
          folded.map(index => HIDE_ON_PHONE[index + 1]),
          mobileCards && 'max-sm:hidden',
        )}
      >
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-slate-600 text-left text-slate-400'>
              {headers.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  scope='col'
                  className={clsx(
                    'px-2 py-2 font-medium',
                    numeric.has(index) && 'text-right',
                  )}
                >
                  {header}
                </th>
              ))}
              {folds && (
                <th scope='col' className='w-8 px-1 sm:hidden'>
                  <span className='sr-only'>More</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {folds
              ? flatten(children).map((row, index) =>
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
                )
              : children}
          </tbody>
          {footer && (
            <tfoot className='border-t-2 border-slate-600 font-medium'>
              {footer}
            </tfoot>
          )}
        </table>
      </div>
      {mobileCards && <div className='not-prose sm:hidden'>{mobileCards}</div>}
    </>
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
  const hidden = folded.filter(index => cells[index] !== undefined);

  // A row with fewer cells than columns, like a divider, has nothing to fold.
  if (hidden.length === 0) return row;

  return (
    <>
      {cloneElement(
        row,
        {},
        ...cells,
        <td key='fold' className='w-8 px-1 py-1 text-right sm:hidden'>
          <button
            type='button'
            aria-expanded={open}
            aria-label={open ? 'Show less' : 'Show more'}
            onClick={() => setOpen(value => !value)}
            className='inline-flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-700 hover:text-white'
          >
            <ChevronDownIcon
              aria-hidden='true'
              className={clsx(
                'h-4 w-4 transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        </td>,
      )}
      {open && (
        <tr className='border-b border-slate-700/70 bg-slate-900/40 sm:hidden'>
          <td colSpan={span} className='px-2 py-1'>
            <table className='w-full text-sm'>
              <tbody>
                {hidden.map(index => (
                  <tr key={index}>
                    <th
                      scope='row'
                      className='w-1/2 py-1 pr-2 text-left text-xs font-medium text-slate-400'
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
    <ul className='m-0 list-none divide-y divide-slate-700/70 border-y border-slate-700/70 p-0'>
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
    <li className='py-2.5'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='text-sm text-slate-100'>{title}</div>
          {subtitle && (
            <div className='mt-0.5 text-xs text-slate-400'>{subtitle}</div>
          )}
        </div>
        {(value !== undefined || status) && (
          <div className='shrink-0 text-right'>
            {value !== undefined && (
              <div className='text-sm font-medium tabular-nums'>{value}</div>
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
