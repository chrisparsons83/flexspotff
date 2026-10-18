import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { PageHeader } from '~/components/ui/page-header';
import { SubNav } from '~/components/ui/sub-nav';
import { getAllOmniSeasons } from '~/models/omniseason.server';
import { OMNI_RULES_YEARS } from '~/utils/constants';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  const seasons = await getAllOmniSeasons();
  if (!seasons.some(season => season.year === year)) {
    throw new Response('No Omni that year', { status: 404 });
  }
  return typedjson({ year });
};

export default function OmniSeason() {
  const { year } = useTypedLoaderData<typeof loader>();
  const base = `/games/omni/${year}`;

  return (
    <>
      <PageHeader
        title={`Omni ${year}`}
        nav={
          <SubNav
            label={`Omni ${year}`}
            items={[
              { label: 'Standings', to: base, end: true },
              { label: 'Draft board', to: `${base}/draft` },
              { label: 'Qualifying points', to: `${base}/qualifying-points` },
              ...(OMNI_RULES_YEARS.includes(year)
                ? [{ label: 'Rules', to: `${base}/rules` }]
                : []),
              { label: 'All seasons', to: '/games/omni', end: true },
            ]}
          />
        }
      />
      <Outlet />
    </>
  );
}
