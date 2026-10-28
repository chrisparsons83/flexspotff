import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { EmptyState } from '~/components/ui/empty-state';
import { Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { Section } from '~/components/ui/section';
import { SummaryCard } from '~/components/ui/summary-card';
import type { SideLeagueSummary } from '~/libs/side-leagues/overview.server';
import { getSideLeaguesOverview } from '~/libs/side-leagues/overview.server';
import { authenticator } from '~/services/auth.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Side leagues' };

/** How many rows each table on the overview lists. */
const LEADERS = 5;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request);
  return typedjson(
    await getSideLeaguesOverview({ signedIn: !!user, leaders: LEADERS }),
  );
};

const Summary = ({ summary }: { summary: SideLeagueSummary }) => (
  <SummaryCard
    title={summary.title}
    to={summary.to}
    status={summary.status || undefined}
    rows={summary.rows}
    empty={summary.empty}
  />
);

export default function SideLeagues() {
  const { guillotine, d12, bestBall } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader
        title='Side leagues'
        description='Separate fantasy leagues with their own drafts and rosters, run alongside the main ones.'
      />
      <Section
        title='Guillotine'
        description='Every week the lowest-scoring team is chopped, and its whole roster goes to waivers.'
        action={<Link to='/side-leagues/guillotine'>Every season</Link>}
      >
        {guillotine && guillotine.leagues.length > 0 ? (
          <div className='grid gap-6 md:grid-cols-2'>
            {guillotine.leagues.map(league => (
              <Summary key={league.to} summary={league} />
            ))}
          </div>
        ) : (
          <EmptyState title='No guillotine leagues yet' />
        )}
      </Section>
      <div className='mt-16 grid gap-x-6 gap-y-16 md:grid-cols-2'>
        <Section
          className='mt-0'
          title='D12'
          description='Twelve best-ball leagues with the same twelve managers, each drafting once from every slot.'
          action={<Link to='/side-leagues/d12'>Every season</Link>}
        >
          {d12 ? (
            <Summary summary={d12} />
          ) : (
            <EmptyState title='No D12 seasons yet' />
          )}
        </Section>
        <Section
          className='mt-0'
          title='Autodraft BBM'
          description='The CPU drafts every roster, Sleeper plays the best lineup, and the most points for wins.'
          action={<Link to='/side-leagues/best-ball'>Every season</Link>}
        >
          {bestBall ? (
            <Summary summary={bestBall} />
          ) : (
            <EmptyState title='No Autodraft BBM leagues yet' />
          )}
        </Section>
      </div>
    </>
  );
}
