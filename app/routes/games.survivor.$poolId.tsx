import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import PickChip from '~/components/layout/survivor/PickChip';
import GoBox from '~/components/ui/GoBox';
import { ExternalLink } from '~/components/ui/link';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { requireSurvivorAccess } from '~/libs/survivor/access.server';
import { buildBoard, poolTitle, summarizeWeeks } from '~/libs/survivor/views';
import {
  getAllSurvivorPools,
  getSurvivorPoolWithEntries,
} from '~/models/survivor.server';
import { cn } from '~/utils';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireSurvivorAccess(request);

  const [pool, allPools] = await Promise.all([
    getSurvivorPoolWithEntries(params.poolId ?? ''),
    getAllSurvivorPools(),
  ]);
  if (!pool) throw new Response('Pool not found', { status: 404 });

  return typedjson({
    pool: {
      id: pool.id,
      name: pool.name,
      year: pool.year,
      source: pool.source,
      externalId: pool.externalId,
      isComplete: pool.isComplete,
      inviteUrl: pool.isComplete ? null : pool.inviteUrl,
      lastSyncedAt: pool.lastSyncedAt,
    },
    board: buildBoard(pool.startWeek, pool.entries),
    weeks: summarizeWeeks(pool.startWeek, pool.entries),
    allPools: allPools.map(p => ({
      label: poolTitle(p),
      url: `/games/survivor/${p.id}`,
    })),
  });
};

const placeLabel = (row: {
  finish: number | null;
  eliminatedWeek: number | null;
}) =>
  row.finish === 1
    ? 'Winner'
    : row.eliminatedWeek
    ? `Out week ${row.eliminatedWeek}`
    : 'Alive';

/** The surface the board sits on, so the pinned entry column matches it. */
const PINNED =
  'sticky left-0 z-10 bg-[oklch(var(--surface,var(--background)))]';

export default function SurvivorPool() {
  const { pool, board, weeks, allPools } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <Section
        title={poolTitle(pool)}
        description={
          pool.source === 'YAHOO'
            ? 'Played on Yahoo.'
            : pool.isComplete
            ? 'Played on Sleeper.'
            : 'Live on Sleeper, synced hourly.'
        }
        action={
          <div className='flex flex-wrap items-center gap-4'>
            {pool.source === 'SLEEPER' && (
              <ExternalLink
                href={
                  pool.inviteUrl ??
                  `https://sleeper.com/leagues/${pool.externalId}`
                }
                target='_blank'
              >
                {pool.inviteUrl ? 'Join on Sleeper' : 'Open in Sleeper'}
              </ExternalLink>
            )}
            <GoBox options={allPools} buttonText='Pool' />
          </div>
        }
      >
        <Section as='h3' title='Week by week' className='mt-0'>
          <Table
            headers={['Week', 'Alive', 'Out', 'Most picked', 'Did the damage']}
            numericColumns={[1, 2]}
            primaryColumns={[1, 2]}
          >
            {weeks.map(week => {
              const out = week.aliveBefore - week.aliveAfter;
              const damage = [
                week.topBust &&
                  `${week.topBust.team} took out ${week.topBust.count}`,
                week.missed > 0 &&
                  `${week.missed} missed ${
                    week.missed === 1 ? 'a pick' : 'picks'
                  }`,
              ].filter((line): line is string => Boolean(line));
              return (
                <tr key={week.week}>
                  <td>Week {week.week}</td>
                  <td className='text-right'>
                    {week.aliveAfter}
                    <span className='text-muted-foreground'>
                      {' '}
                      of {week.aliveBefore}
                    </span>
                  </td>
                  <td
                    className={cn(
                      'text-right',
                      out > 0 ? 'text-negative' : 'text-muted-foreground',
                    )}
                  >
                    {out || '–'}
                  </td>
                  <td>
                    {week.topPick ? (
                      <span className='inline-flex items-center gap-2'>
                        <PickChip cell={{ kind: 'pick', ...week.topPick }} />
                        <span className='text-sm text-muted-foreground'>
                          {week.topPick.count} of {week.aliveBefore}
                        </span>
                      </span>
                    ) : (
                      '–'
                    )}
                  </td>
                  <td className='text-sm text-muted-foreground'>
                    {damage.length > 0
                      ? damage.map(line => <div key={line}>{line}</div>)
                      : '–'}
                  </td>
                </tr>
              );
            })}
          </Table>
        </Section>

        <Section
          as='h3'
          title='Every pick'
          description='A win is in bold, a loss struck through, and a game not played yet is muted. None is a week with no pick.'
        >
          <div className='overflow-x-auto'>
            <table className='text-sm'>
              <thead>
                <tr className='border-b border-border text-left text-muted-foreground'>
                  <th className={cn(PINNED, 'px-2 py-2 font-semibold')}>
                    Entry
                  </th>
                  {board.weeks.map(week => (
                    <th
                      key={week}
                      className='px-1 py-2 text-center font-semibold tabular-nums'
                    >
                      {week}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {board.rows.map(row => (
                  <tr key={row.id} className='border-b border-border'>
                    <th
                      scope='row'
                      className={cn(
                        PINNED,
                        'max-w-[11rem] px-2 py-1.5 text-left font-normal',
                      )}
                    >
                      <div className='truncate'>
                        {row.userId ? (
                          <ProfileLink userId={row.userId} tab='survivor'>
                            {row.name}
                          </ProfileLink>
                        ) : (
                          row.name
                        )}
                      </div>
                      <div
                        className={cn(
                          'truncate text-sm',
                          row.finish === 1
                            ? 'font-semibold'
                            : row.eliminatedWeek
                            ? 'text-muted-foreground'
                            : 'text-positive',
                        )}
                      >
                        {placeLabel(row)}
                      </div>
                      {row.entryName && (
                        <div className='truncate text-sm text-muted-foreground'>
                          {row.entryName}
                        </div>
                      )}
                    </th>
                    {row.cells.map((cell, index) => (
                      <td
                        key={board.weeks[index]}
                        className='px-1 py-1.5 text-center'
                      >
                        <PickChip cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </Section>
    </>
  );
}
