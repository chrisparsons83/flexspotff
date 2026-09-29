import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { requireGuillotineAccess } from '~/libs/guillotine/access.server';
import { teamName } from '~/libs/guillotine/display';
import { getGuillotineHistory } from '~/models/guillotine.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireGuillotineAccess(request);

  const seasons = await getGuillotineHistory();

  return typedjson({
    seasons: seasons.map(season => ({
      year: season.year,
      leagues: season.leagues.map(league => {
        const byFinish = (place: number) =>
          league.teams.find(team => team.finish === place);
        const champion = byFinish(1);
        const alive = league.teams.filter(
          team => team.choppedWeek === null && team.finish !== 1,
        );
        return {
          id: league.id,
          name: league.name,
          isComplete: league.isComplete,
          lastScoredWeek: league.lastScoredWeek,
          teamCount: league.teams.length,
          aliveCount: alive.length,
          champion: champion ? teamName(champion) : null,
          runnerUp: byFinish(2) ? teamName(byFinish(2)!) : null,
          third: byFinish(3) ? teamName(byFinish(3)!) : null,
        };
      }),
    })),
  });
};

export default function GuillotineHistory() {
  const { seasons } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <h2>Guillotine Leagues</h2>
      <p>
        Every week the lowest-scoring team is chopped, and its whole roster goes
        to waivers. Last team standing after week 17 wins.
      </p>

      {seasons.length === 0 && <p>No guillotine leagues yet.</p>}

      <div className='not-prose space-y-6'>
        {seasons.map(season => (
          <section key={season.year}>
            <h3 className='mb-2 text-xl font-semibold text-white'>
              {season.year}
            </h3>
            <div className='grid gap-3 md:grid-cols-2'>
              {season.leagues.map(league => (
                <Link
                  key={league.id}
                  to={league.id}
                  className='block rounded-lg border border-slate-600/50 bg-slate-800/60 p-4 text-white no-underline hover:border-slate-400'
                >
                  <div className='font-semibold'>{league.name}</div>
                  {league.isComplete ? (
                    <dl className='mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm'>
                      <dt className='text-amber-300'>Champion</dt>
                      <dd className='m-0 font-semibold'>{league.champion}</dd>
                      <dt className='text-slate-400'>Runner-up</dt>
                      <dd className='m-0'>{league.runnerUp ?? '—'}</dd>
                      <dt className='text-slate-400'>Third</dt>
                      <dd className='m-0'>{league.third ?? '—'}</dd>
                    </dl>
                  ) : (
                    <p className='m-0 mt-3 text-sm text-slate-300'>
                      <span className='mr-2 rounded bg-rose-700 px-1.5 py-0.5 text-xs font-bold uppercase text-white'>
                        Live
                      </span>
                      {league.lastScoredWeek > 0
                        ? `${league.aliveCount} of ${league.teamCount} still standing after week ${league.lastScoredWeek}`
                        : `${league.teamCount} teams, nobody chopped yet`}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
