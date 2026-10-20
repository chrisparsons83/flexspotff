import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { bestBallTabs } from '~/components/layout/side-leagues/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { EmptyState } from '~/components/ui/empty-state';
import { Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { SubNav } from '~/components/ui/sub-nav';
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
    <>
      <PageHeader
        title='Autodraft BBM'
        description='Twelve teams, eighteen rounds, and nobody drafts: the CPU autopicks every roster. Each week Sleeper plays your best possible lineup, and the most points for through week 17 wins. Win-loss record does not count.'
        nav={
          <SubNav
            label='Autodraft BBM'
            items={bestBallTabs(leagues[0]?.year ?? null)}
          />
        }
      />

      {leagues.length === 0 && (
        <EmptyState title='No Autodraft BBM leagues yet'>
          Each season’s league appears here once it is set up on Sleeper.
        </EmptyState>
      )}

      <div className='grid gap-6 md:grid-cols-2'>
        {leagues.map(league => (
          <Card key={league.year}>
            <CardHeader>
              <CardTitle>
                <Link to={`${league.year}`} variant='quiet'>
                  {league.year}
                </Link>
              </CardTitle>
              <span className='truncate text-sm'>{league.name}</span>
            </CardHeader>
            <CardContent>
              {!league.isComplete && (
                <p className='mb-3'>
                  <span className='font-semibold'>Live. </span>
                  <span className='text-muted-foreground'>
                    {league.lastScoredWeek > 0
                      ? `Leaders after week ${league.lastScoredWeek}.`
                      : 'No weeks scored yet.'}
                  </span>
                </p>
              )}
              {league.podium.length > 0 && (
                <dl className='grid grid-cols-[auto_1fr_auto] gap-x-4 gap-y-1'>
                  {league.podium.map((team, index) => (
                    <div key={index} className='contents'>
                      <dt className='text-muted-foreground'>
                        {league.isComplete ? PLACES[index] : index + 1}
                      </dt>
                      <dd className={index === 0 ? 'font-semibold' : undefined}>
                        {team.name}
                      </dd>
                      <dd className='text-right tabular-nums text-muted-foreground'>
                        {pts(team.pointsFor)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
