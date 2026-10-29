import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { guillotineTabs } from '~/components/layout/side-leagues/tabs';
import GoBox from '~/components/ui/GoBox';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { EmptyState } from '~/components/ui/empty-state';
import { Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { Section } from '~/components/ui/section';
import { SubNav } from '~/components/ui/sub-nav';
import { requireGuillotineAccess } from '~/libs/guillotine/access.server';
import { teamName } from '~/libs/guillotine/display';
import {
  getAllGuillotineLeagues,
  getGuillotineHistory,
} from '~/models/guillotine.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireGuillotineAccess(request);

  const [seasons, allLeagues] = await Promise.all([
    getGuillotineHistory(),
    getAllGuillotineLeagues(),
  ]);

  return typedjson({
    allLeagues: allLeagues.map(league => ({
      label: `${league.season.year} ${league.name}`,
      url: `/side-leagues/guillotine/${league.id}`,
    })),
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
  const { seasons, allLeagues } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader
        title='Guillotine'
        description='Every week the lowest-scoring team is chopped, and its whole roster goes to waivers. Last team standing after week 17 wins.'
        nav={
          <SubNav
            label='Guillotine'
            items={guillotineTabs(null)}
            picker={
              allLeagues.length > 0 && (
                <GoBox options={allLeagues} buttonText='League' />
              )
            }
          />
        }
      />

      {seasons.length === 0 && (
        <EmptyState title='No guillotine leagues yet'>
          Each season’s leagues appear here once they are set up on Sleeper.
        </EmptyState>
      )}

      {seasons.map(season => (
        <Section key={season.year} title={season.year}>
          <div className='grid gap-6 md:grid-cols-2'>
            {season.leagues.map(league => (
              <Card key={league.id}>
                <CardHeader>
                  <CardTitle>
                    <Link to={league.id} variant='quiet'>
                      {league.name}
                    </Link>
                  </CardTitle>
                  {!league.isComplete && (
                    <span className='font-semibold'>Live</span>
                  )}
                </CardHeader>
                <CardContent>
                  {league.isComplete ? (
                    <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1'>
                      <dt className='text-muted-foreground'>Champion</dt>
                      <dd className='font-semibold'>{league.champion}</dd>
                      <dt className='text-muted-foreground'>Runner-Up</dt>
                      <dd>{league.runnerUp ?? '–'}</dd>
                      <dt className='text-muted-foreground'>Third</dt>
                      <dd>{league.third ?? '–'}</dd>
                    </dl>
                  ) : (
                    <p className='text-muted-foreground'>
                      {league.lastScoredWeek > 0
                        ? `${league.aliveCount} of ${league.teamCount} still standing after week ${league.lastScoredWeek}.`
                        : `${league.teamCount} teams, nobody chopped yet.`}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
