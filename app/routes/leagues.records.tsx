import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import RecordsTable from '~/components/layout/records/RecordsTable';
import { Section } from '~/components/ui/section';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import type { RecordTable } from '~/models/records.server';
import {
  getCareerRecords,
  getCupRecords,
  getPlayoffRecords,
  getSingleGameRecords,
  getSingleSeasonRecords,
  getStreakRecords,
} from '~/models/records.server';
import { getUnfinishedLeagueIds } from '~/models/season.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Records' };

const CATEGORIES = [
  { key: 'career', label: 'Career' },
  { key: 'season', label: 'Single Season' },
  { key: 'game', label: 'Single Game' },
  { key: 'playoffs', label: 'Playoffs' },
  { key: 'cup', label: 'Cup' },
  { key: 'streaks', label: 'Streaks' },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

export const loader = async () => {
  const unfinished = await getUnfinishedLeagueIds();

  const [career, season, game, playoffs, cup, streaks] = await Promise.all([
    getCareerRecords(unfinished),
    getSingleSeasonRecords(unfinished),
    getSingleGameRecords(),
    getPlayoffRecords(),
    getCupRecords(),
    getStreakRecords(),
  ]);

  return typedjson({ career, season, game, playoffs, cup, streaks });
};

export default function Records() {
  const tables = useTypedLoaderData<typeof loader>();

  return (
    <Section title='Record Books'>
      <Tabs defaultValue='career'>
        <TabsList>
          {CATEGORIES.map(category => (
            <TabsTrigger key={category.key} value={category.key}>
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {CATEGORIES.map(category => (
          <TabsContent key={category.key} value={category.key}>
            <Category tables={tables[category.key as CategoryKey]} />
          </TabsContent>
        ))}
      </Tabs>
    </Section>
  );
}

/** One category's tables, one at a time, picked from a list. */
function Category({ tables }: { tables: RecordTable[] }) {
  const [index, setIndex] = useState(0);
  const table = tables[index] ?? tables[0];
  if (!table) return null;

  return (
    <>
      {tables.length > 1 && (
        <Select
          value={String(index)}
          onValueChange={value => setIndex(Number(value))}
        >
          <SelectTrigger className='mb-6 max-w-md' aria-label='Record'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tables.map((option, i) => (
              <SelectItem key={option.title} value={String(i)}>
                {option.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <RecordsTable
        title={table.title}
        headers={table.headers}
        rows={table.rows}
      />
    </>
  );
}
