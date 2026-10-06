import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { requireSurvivorAccess } from '~/libs/survivor/access.server';
import { buildAllTime, entryLabel, poolTitle } from '~/libs/survivor/views';
import { getSurvivorHistory } from '~/models/survivor.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireSurvivorAccess(request);

  const pools = await getSurvivorHistory();

  const cards = pools.map(pool => {
    const alive = pool.entries.filter(entry => entry.eliminatedWeek === null);
    const lastWeek = Math.max(
      pool.startWeek,
      ...pool.entries.flatMap(entry => entry.picks.map(pick => pick.week)),
    );
    // Through the last week every surviving pick has been settled.
    const settledWeek = Math.max(0, ...alive.map(entry => entry.survivedWeek));
    return {
      id: pool.id,
      name: pool.name,
      year: pool.year,
      source: pool.source,
      startWeek: pool.startWeek,
      lastWeek,
      isComplete: pool.isComplete,
      inviteUrl: pool.isComplete ? null : pool.inviteUrl,
      entryCount: pool.entries.length,
      aliveCount: alive.length,
      settledWeek,
      winners: pool.entries
        .filter(entry => pool.isComplete && entry.finish === 1)
        .map(entry => ({
          name: entryLabel(entry),
          userId: entry.user?.id ?? null,
          survivedWeek: entry.survivedWeek,
        })),
    };
  });

  return typedjson({
    years: [...new Set(cards.map(card => card.year))].map(year => ({
      year,
      pools: cards.filter(card => card.year === year),
    })),
    allTime: buildAllTime(pools),
  });
};

const weekSpan = (from: number, to: number) =>
  from === to ? `Week ${from}` : `Weeks ${from}–${to}`;

export default function SurvivorHistory() {
  const { years, allTime } = useTypedLoaderData<typeof loader>();
  const open = years.flatMap(year => year.pools).find(pool => pool.inviteUrl);

  return (
    <div>
      <h2>Survivor</h2>
      <p>
        Pick one NFL team to win each week, and never the same team twice. A
        loss or a missed pick and you're out. Whoever lasts longest wins, and
        entries that go out in the same week share the win. When everyone is
        out, a new pool starts the next week.
      </p>

      {open && (
        <p className='not-prose rounded-lg border border-sky-500/40 bg-sky-950/40 p-3 text-sm text-sky-100'>
          {poolTitle(open)} is running.{' '}
          <a
            href={open.inviteUrl!}
            target='_blank'
            rel='noreferrer'
            className='font-semibold text-white underline'
          >
            Join on Sleeper
          </a>
        </p>
      )}

      {years.length === 0 && <p>No survivor pools yet.</p>}

      <div className='not-prose space-y-6'>
        {years.map(({ year, pools }) => (
          <section key={year}>
            <h3 className='mb-2 text-xl font-semibold text-white'>{year}</h3>
            <div className='grid gap-3 md:grid-cols-2'>
              {pools.map(pool => (
                <Link
                  key={pool.id}
                  to={pool.id}
                  className='block rounded-lg border border-slate-600/50 bg-slate-800/60 p-4 text-white no-underline hover:border-slate-400'
                >
                  <div className='flex items-baseline justify-between gap-2'>
                    <span className='font-semibold'>{pool.name}</span>
                    <span className='shrink-0 text-xs text-slate-400'>
                      {pool.source === 'YAHOO' ? 'Yahoo' : 'Sleeper'}
                    </span>
                  </div>
                  <div className='mt-1 text-sm text-slate-400'>
                    {weekSpan(pool.startWeek, pool.lastWeek)} ·{' '}
                    {pool.entryCount} entries
                  </div>
                  {pool.isComplete ? (
                    <dl className='mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm'>
                      <dt className='text-gold'>
                        {pool.winners.length > 1 ? 'Co-winners' : 'Winner'}
                      </dt>
                      <dd className='m-0 font-semibold'>
                        {pool.winners.map(winner => winner.name).join(', ')}
                        <span className='ml-1.5 font-normal text-slate-400'>
                          through week {pool.winners[0]?.survivedWeek}
                        </span>
                      </dd>
                    </dl>
                  ) : (
                    <p className='m-0 mt-3 text-sm text-slate-300'>
                      <span className='mr-2 rounded bg-rose-700 px-1.5 py-0.5 text-xs font-bold uppercase text-white'>
                        Live
                      </span>
                      {pool.settledWeek > 0
                        ? `${pool.aliveCount} of ${pool.entryCount} still alive after week ${pool.settledWeek}`
                        : `${pool.entryCount} entries, nobody out yet`}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {allTime.length > 0 && (
        <section className='mt-10'>
          <h3>All Time</h3>
          <p className='text-sm'>
            Members ranked by pools won, then by their longest run of winning
            picks.
          </p>
          <div className='not-prose overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-slate-600 text-left text-slate-400'>
                  <th className='px-2 py-1 font-semibold'>Member</th>
                  <th className='px-2 py-1 text-right font-semibold'>Pools</th>
                  <th className='px-2 py-1 text-right font-semibold'>Wins</th>
                  <th className='px-2 py-1 text-right font-semibold'>
                    Longest Run
                  </th>
                  <th className='px-2 py-1 text-right font-semibold'>
                    Winning Picks
                  </th>
                </tr>
              </thead>
              <tbody>
                {allTime.map(row => (
                  <tr key={row.userId} className='border-b border-slate-700/60'>
                    <td className='px-2 py-1.5'>
                      <Link
                        to={`/members/${row.userId}/survivor`}
                        className='text-white no-underline hover:underline'
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className='px-2 py-1.5 text-right tabular-nums'>
                      {row.pools}
                    </td>
                    <td className='px-2 py-1.5 text-right font-semibold tabular-nums text-white'>
                      {row.wins || '—'}
                    </td>
                    <td className='px-2 py-1.5 text-right tabular-nums'>
                      {row.longestRun}
                    </td>
                    <td className='px-2 py-1.5 text-right tabular-nums'>
                      {row.weeksSurvived}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
