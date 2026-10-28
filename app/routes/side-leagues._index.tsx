import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { EmptyState } from '~/components/ui/empty-state';
import { PageHeader } from '~/components/ui/page-header';
import { Section } from '~/components/ui/section';
import { SummaryCard } from '~/components/ui/summary-card';
import type { SideLeagueSummary } from '~/libs/side-leagues/overview.server';
import { getSideLeaguesOverview } from '~/libs/side-leagues/overview.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Side leagues' };

/** How many rows each table on the overview lists. */
const LEADERS = 5;

export const loader = async () => {
  return typedjson(await getSideLeaguesOverview({ leaders: LEADERS }));
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
        to='/side-leagues/guillotine'
        description='Every week the lowest-scoring team is chopped, and its whole roster goes to waivers.'
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
          to='/side-leagues/d12'
          description='Twelve best-ball leagues with the same twelve managers, each drafting once from every slot.'
        >
          {d12 ? (
            <Summary summary={d12} />
          ) : (
            <EmptyState title='No D12 seasons yet' />
          )}
        </Section>
        <Section
          className='mt-0'
          title='Autodraft Best Ball Mania'
          to='/side-leagues/best-ball'
          description='Set a draft queue and let autodraft make your picks. It is best ball, so Sleeper plays your best lineup every week, and the most points for wins.'
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
