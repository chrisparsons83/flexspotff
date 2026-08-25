import clsx from 'clsx';
import type { ReactNode } from 'react';

type Props = {
  headers: string[];
  /** Right-align numeric columns by index. */
  numericColumns?: number[];
  children: ReactNode;
};

/**
 * The table shell every profile table shares, so the tabs look alike. Wide
 * tables scroll inside their own container rather than the page.
 */
export default function ProfileTable({
  headers,
  numericColumns = [],
  children,
}: Props) {
  const numeric = new Set(numericColumns);

  return (
    <div className='not-prose overflow-x-auto'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='border-b border-gray-700 text-left text-gray-400'>
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
      </table>
    </div>
  );
}
