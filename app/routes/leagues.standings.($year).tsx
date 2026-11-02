import { ChevronRightIcon } from '@radix-ui/react-icons';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import LeagueTable from '~/components/layout/standings/LeagueTable';
import { Card, CardHeader, CardTitle } from '~/components/ui/card';
import { EmptyState } from '~/components/ui/empty-state';
import { leagueFill } from '~/components/ui/fills';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { getLeaguesByYear } from '~/models/league.server';
import { getCurrentSeason } from '~/models/season.server';
import { FIRST_YEAR } from '~/utils/constants';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ params }) =>
    params.year ? `${params.year} Standings` : 'Standings',
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const currentSeason = await getCurrentSeason();

  const year = params.year ? Number(params.year) : currentSeason?.year;
  if (params.year && (!Number.isInteger(year) || year! < FIRST_YEAR)) {
    throw new Response('Season not found', { status: 404 });
  }

  const leagues = year ? await getLeaguesByYear(year) : [];

  return typedjson({ leagues, year: year ?? null });
};

export default function Standings() {
  const { leagues, year } = useTypedLoaderData<typeof loader>();

  return (
    <Section title={year ? `${year} Standings` : 'Standings'}>
      {leagues.length === 0 ? (
        <EmptyState title='No leagues for this season yet'>
          Standings appear once the leagues are set up.
        </EmptyState>
      ) : (
        <div className='grid gap-8'>
          {leagues.map(league => (
            <Card
              key={league.id}
              league={leagueFill(league.name) ?? undefined}
              className='min-w-0'
            >
              <CardHeader>
                <CardTitle className='text-lg'>
                  <Link
                    to={`/leagues/${league.year}/${league.name.toLowerCase()}`}
                    variant='quiet'
                    className='inline-flex'
                  >
                    {league.name}
                    <ChevronRightIcon
                      aria-hidden
                      className='ml-1 size-5 self-center'
                    />
                  </Link>
                </CardTitle>
                <span className='text-sm'>Tier {league.tier}</span>
              </CardHeader>
              <LeagueTable league={league} />
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}
