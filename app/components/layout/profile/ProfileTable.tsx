import clsx from 'clsx';
import type { ReactNode } from 'react';

type Props = {
  headers: string[];
  /** Right-align numeric columns by index. */
  numericColumns?: number[];
  /** A totals row, set apart from the body and pinned to the bottom. */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * The table shell every profile table shares, so the tabs look alike. Wide
 * tables scroll inside their own container rather than the page.
 */
export default function ProfileTable({
  headers,
  numericColumns = [],
  footer,
  children,
}: Props) {
  const numeric = new Set(numericColumns);

  return (
    <div className='not-prose overflow-x-auto'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='border-b border-slate-600 text-left text-slate-400'>
            {headers.map((header, index) => (
              <th
                key={header}
                scope='col'
                className={clsx(
                  'px-2 py-2 font-medium',
                  numeric.has(index) && 'text-right',
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {footer && (
          <tfoot className='border-t-2 border-slate-600 font-medium'>
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  );
}
