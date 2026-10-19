import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import FSquaredStandingsTable from '~/components/layout/f-squared/FSquaredStandingsTable';
import StandingsSection from '~/components/layout/games/StandingsSection';
import {
  getFSquaredYears,
  getStandingsForYear,
} from '~/models/fsquared.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ params }) => `${params.year} standings`,
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  if (!Number.isInteger(year)) {
    throw new Response('Not Found', { status: 404 });
  }

  const [results, years] = await Promise.all([
    getStandingsForYear(year),
    getFSquaredYears(),
  ]);
  if (results.length === 0) {
    throw new Response('No F² that year', { status: 404 });
  }

  return typedjson({ year, results, years });
};

export default function FSquaredStandings() {
  const { year, results, years } = useTypedLoaderData<typeof loader>();

  return (
    <StandingsSection
      base='/games/f-squared/standings'
      year={year}
      years={years}
      weeks={[]}
      description='The combined points for of the teams each member picked.'
    >
      <FSquaredStandingsTable results={results} />
    </StandingsSection>
  );
}
