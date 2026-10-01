import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { requireBestBallAccess } from '~/libs/best-ball/access.server';
import { pts, teamName } from '~/libs/guillotine/display';
import { getBestBallHistory } from '~/models/bestball.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireBestBallAccess(request);

  const leagues = await getBestBallHistory();

  return typedjson({
    leagues: leagues.map(league => ({
      year: league.season.year,
      name: league.name,
      isComplete: league.isComplete,
      lastScoredWeek: league.lastScoredWeek,
      // Teams come in points-for order, so the top three are the podium,
      // final or so far.
      podium: league.teams.slice(0, 3).map(team => ({
        name: teamName(team),
        pointsFor: team.pointsFor,
      })),
    })),
  });
};

const PLACES = ['Champion', 'Runner-up', 'Third'];

export default function BestBallHistory() {
  const { leagues } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <h2>Autodraft Best Ball Mania</h2>
      <p>
        Twelve teams, eighteen rounds, and nobody drafts: the CPU autopicks
        every roster. Each week Sleeper plays your best possible lineup, and the
        most points for through week 17 wins. Win-loss record does not count.
      </p>

      {leagues.length === 0 && <p>No best ball leagues yet.</p>}

      <div className='not-prose grid gap-3 md:grid-cols-2'>
        {leagues.map(league => (
          <Link
            key={league.year}
            to={`${league.year}`}
            className='block rounded-lg border border-slate-600/50 bg-slate-800/60 p-4 text-white no-underline hover:border-slate-400'
          >
            <div className='flex items-baseline justify-between gap-2'>
              <span className='text-xl font-semibold'>{league.year}</span>
              <span className='truncate text-sm text-slate-400'>
                {league.name}
              </span>
            </div>
            {!league.isComplete && (
              <p className='m-0 mt-2 text-sm text-slate-300'>
                <span className='mr-2 rounded bg-rose-700 px-1.5 py-0.5 text-xs font-bold uppercase text-white'>
                  Live
                </span>
                {league.lastScoredWeek > 0
                  ? `Leaders after week ${league.lastScoredWeek}`
                  : 'No weeks scored yet'}
              </p>
            )}
            {league.podium.length > 0 && (
              <dl className='mt-3 grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 text-sm'>
                {league.podium.map((team, index) => (
                  <div key={index} className='contents'>
                    <dt
                      className={
                        index === 0 && league.isComplete
                          ? 'text-amber-300'
                          : 'text-slate-400'
                      }
                    >
                      {league.isComplete ? PLACES[index] : `${index + 1}.`}
                    </dt>
                    <dd
                      className={
                        index === 0 ? 'm-0 font-semibold' : 'm-0 text-slate-200'
                      }
                    >
                      {team.name}
                    </dd>
                    <dd className='m-0 text-right tabular-nums text-slate-300'>
                      {pts(team.pointsFor)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
