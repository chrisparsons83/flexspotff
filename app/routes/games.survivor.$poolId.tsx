import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import clsx from 'clsx';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import PickChip from '~/components/layout/survivor/PickChip';
import GoBox from '~/components/ui/GoBox';
import { requireSurvivorAccess } from '~/libs/survivor/access.server';
import { buildBoard, poolTitle, summarizeWeeks } from '~/libs/survivor/views';
import {
  getAllSurvivorPools,
  getSurvivorPoolWithEntries,
} from '~/models/survivor.server';

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

export default function SurvivorPool() {
  const { pool, board, weeks, allPools } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
        <h2 className='mb-0 break-words'>{poolTitle(pool)}</h2>
        <GoBox options={allPools} buttonText='Choose Pool' />
      </div>
      <p className='mt-1 text-sm'>
        <Link to='/games/survivor'>All pools</Link> ·{' '}
        {pool.source === 'YAHOO'
          ? 'Played on Yahoo.'
          : pool.isComplete
          ? 'Played on Sleeper.'
          : 'Live on Sleeper, synced hourly.'}{' '}
        {pool.source === 'SLEEPER' && (
          <a
            href={
              pool.inviteUrl ?? `https://sleeper.com/leagues/${pool.externalId}`
            }
            target='_blank'
            rel='noreferrer'
          >
            {pool.inviteUrl ? 'Join on Sleeper' : 'Open in Sleeper'}
          </a>
        )}
      </p>

      <section className='mb-8'>
        <h3>Week by Week</h3>
        <div className='not-prose overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-slate-600 text-left text-slate-400'>
                <th className='px-2 py-1 font-semibold'>Week</th>
                <th className='px-2 py-1 text-right font-semibold'>Alive</th>
                <th className='px-2 py-1 text-right font-semibold'>Out</th>
                <th className='px-2 py-1 font-semibold'>Most Picked</th>
                <th className='px-2 py-1 font-semibold'>Did the Damage</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map(week => {
                const out = week.aliveBefore - week.aliveAfter;
                return (
                  <tr
                    key={week.week}
                    className='border-b border-slate-700/60 text-slate-200'
                  >
                    <td className='px-2 py-1.5'>Week {week.week}</td>
                    <td className='px-2 py-1.5 text-right tabular-nums'>
                      {week.aliveAfter}
                      <span className='text-slate-500'>
                        /{week.aliveBefore}
                      </span>
                    </td>
                    <td
                      className={clsx(
                        'px-2 py-1.5 text-right tabular-nums',
                        out > 0 ? 'text-rose-300' : 'text-slate-500',
                      )}
                    >
                      {out || '—'}
                    </td>
                    <td className='px-2 py-1.5'>
                      {week.topPick ? (
                        <>
                          <PickChip cell={{ kind: 'pick', ...week.topPick }} />
                          <span className='ml-2 text-xs text-slate-400'>
                            {week.topPick.count} of {week.aliveBefore}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className='px-2 py-1.5 text-xs text-slate-400'>
                      {[
                        week.topBust &&
                          `${week.topBust.team} took out ${week.topBust.count}`,
                        week.missed > 0 &&
                          `${week.missed} missed ${
                            week.missed === 1 ? 'a pick' : 'picks'
                          }`,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Every Pick</h3>
        <p className='text-sm'>
          ✓ won, ✗ lost, … not played yet. "✗ none" is a week with no pick.
        </p>
        <div className='not-prose overflow-x-auto'>
          <table className='text-sm'>
            <thead>
              <tr className='border-b border-slate-600 text-left text-slate-400'>
                <th className='sticky left-0 z-10 bg-slate-700 px-2 py-1 font-semibold'>
                  Entry
                </th>
                {board.weeks.map(week => (
                  <th
                    key={week}
                    className='px-1 py-1 text-center font-semibold tabular-nums'
                  >
                    {week}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.rows.map(row => (
                <tr key={row.id} className='border-b border-slate-700/60'>
                  <th
                    scope='row'
                    className='sticky left-0 z-10 max-w-[11rem] bg-slate-700 px-2 py-1.5 text-left font-normal'
                  >
                    <div className='truncate text-white'>
                      {row.userId ? (
                        <Link
                          to={`/members/${row.userId}/survivor`}
                          className='text-white no-underline hover:underline'
                        >
                          {row.name}
                        </Link>
                      ) : (
                        row.name
                      )}
                    </div>
                    <div
                      className={clsx(
                        'truncate text-xs',
                        row.finish === 1
                          ? 'font-semibold text-gold'
                          : row.eliminatedWeek
                          ? 'text-slate-400'
                          : 'text-emerald-300',
                      )}
                    >
                      {placeLabel(row)}
                      {row.entryName && (
                        <span className='font-normal text-slate-500'>
                          {' '}
                          · {row.entryName}
                        </span>
                      )}
                    </div>
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
      </section>
    </div>
  );
}
