import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import type { RecordTable } from '~/models/records.server';
import {
  getCareerRecords,
  getCupRecords,
  getSingleGameRecords,
  getSingleSeasonRecords,
  getStreakRecords,
} from '~/models/records.server';
import clsx from 'clsx';
import { useState } from 'react';
import RecordsTable from '~/components/layout/records/RecordsTable';

const CATEGORIES = [
  { key: 'career', label: 'Career' },
  { key: 'season', label: 'Single Season' },
  { key: 'game', label: 'Single Game' },
  { key: 'cup', label: 'Cup' },
  { key: 'streaks', label: 'Streaks' },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

export const loader = async () => {
  const [
    careerRecords,
    singleSeasonRecords,
    singleGameRecords,
    cupRecords,
    streakRecords,
  ] = await Promise.all([
    getCareerRecords(),
    getSingleSeasonRecords(),
    getSingleGameRecords(),
    getCupRecords(),
    getStreakRecords(),
  ]);

  return typedjson({
    careerRecords,
    singleSeasonRecords,
    singleGameRecords,
    cupRecords,
    streakRecords,
  });
};

export default function Records() {
  const data = useTypedLoaderData<typeof loader>();
  const [category, setCategory] = useState<CategoryKey>('career');
  const [tableIndex, setTableIndex] = useState(0);

  const tablesMap: Record<CategoryKey, RecordTable[]> = {
    career: data.careerRecords,
    season: data.singleSeasonRecords,
    game: data.singleGameRecords,
    cup: data.cupRecords,
    streaks: data.streakRecords,
  };

  const tables = tablesMap[category];
  const currentTable = tables[tableIndex] ?? tables[0];

  const handleCategoryChange = (key: CategoryKey) => {
    setCategory(key);
    setTableIndex(0);
  };

  return (
    <>
      <h2>Record Books</h2>

      <div className='not-prose my-4 flex flex-wrap gap-2'>
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            type='button'
            onClick={() => handleCategoryChange(cat.key)}
            className={clsx(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              category === cat.key
                ? 'bg-white text-gray-900 shadow'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {tables.length > 1 && (
        <div className='not-prose mb-6'>
          <select
            value={tableIndex}
            onChange={e => setTableIndex(Number(e.target.value))}
            className='rounded-md bg-gray-800 px-3 py-2 text-sm text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-white'
          >
            {tables.map((t, i) => (
              <option key={i} value={i}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {currentTable && (
        <RecordsTable
          title={currentTable.title}
          headers={currentTable.headers}
          rows={currentTable.rows}
        />
      )}
    </>
  );
}
