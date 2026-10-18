import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Link } from '~/components/ui/link';
import type { SurvivorPools } from '~/libs/survivor/pools.server';

type Pool = SurvivorPools['years'][number]['pools'][number];

const weekSpan = (from: number, to: number) =>
  from === to ? `Week ${from}` : `Weeks ${from}–${to}`;

/** A year's pools: who won each one, or how many are still alive. */
export default function PoolCards({ pools }: { pools: Pool[] }) {
  return (
    <div className='grid gap-6 md:grid-cols-2'>
      {pools.map(pool => (
        <Card key={pool.id}>
          <CardHeader>
            <CardTitle>
              <Link to={`/games/survivor/${pool.id}`} variant='quiet'>
                {pool.name}
              </Link>
            </CardTitle>
            <span className='shrink-0 text-sm'>
              {pool.source === 'YAHOO' ? 'Yahoo' : 'Sleeper'}
            </span>
          </CardHeader>
          <CardContent className='grid gap-3'>
            <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1'>
              <dt className='text-muted-foreground'>Weeks</dt>
              <dd>{weekSpan(pool.startWeek, pool.lastWeek)}</dd>
              <dt className='text-muted-foreground'>Entries</dt>
              <dd>{pool.entryCount}</dd>
              {pool.isComplete ? (
                <>
                  <dt className='text-muted-foreground'>
                    {pool.winners.length > 1 ? 'Co-winners' : 'Winner'}
                  </dt>
                  <dd className='font-semibold'>
                    {pool.winners.map(winner => winner.name).join(', ')}
                  </dd>
                  <dt className='text-muted-foreground'>Lasted</dt>
                  <dd>Through week {pool.winners[0]?.survivedWeek}</dd>
                </>
              ) : (
                <>
                  <dt className='text-muted-foreground'>Live</dt>
                  <dd>
                    {pool.settledWeek > 0
                      ? `${pool.aliveCount} of ${pool.entryCount} still alive after week ${pool.settledWeek}`
                      : 'Nobody out yet'}
                  </dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
