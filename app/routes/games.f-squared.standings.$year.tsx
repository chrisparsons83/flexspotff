import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import FSquaredStandingsTable from '~/components/layout/f-squared/FSquaredStandingsTable';
import FSquaredYearPicker from '~/components/layout/f-squared/FSquaredYearPicker';
import {
  getFSquaredYears,
  getStandingsForYear,
} from '~/models/fsquared.server';

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

export default function FSquaredYearStandings() {
  const { year, results, years } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <FSquaredYearPicker years={years} />
      <h2>{year} F² Standings</h2>
      <p>
        <Link to='/games/f-squared'>Back to this season</Link>
      </p>
      <FSquaredStandingsTable results={results} />
    </>
  );
}
