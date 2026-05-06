import clsx from 'clsx';
import type { RecordRow } from '~/models/records.server';
import { isLeagueName, RANK_COLORS } from '~/utils/constants';

type Props = {
  title: string;
  headers: string[];
  rows: RecordRow[];
};

export default function RecordsTable({ title, headers, rows }: Props) {
  return (
    <section className='mb-8'>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th></th>
            {headers.map((header, i) => (
              <th key={i}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className={clsx(
                index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800',
              )}
            >
              <td className='px-2'>
                <div
                  className={clsx(
                    isLeagueName(row.leagueName ?? '')
                      ? RANK_COLORS[row.leagueName as keyof typeof RANK_COLORS]
                      : 'bg-gray-700 text-gray-200',
                    'mx-auto w-8 h-8 flex justify-center items-center font-bold text-sm',
                  )}
                >
                  {index + 1}
                </div>
              </td>
              {row.cells.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
