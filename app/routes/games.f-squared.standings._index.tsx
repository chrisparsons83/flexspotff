import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import FSquaredStandingsTable from '~/components/layout/f-squared/FSquaredStandingsTable';
import StandingsSection from '~/components/layout/games/StandingsSection';
import {
  getFSquaredYears,
  getStandingsForYear,
} from '~/models/fsquared.server';
import { getCurrentSeason } from '~/models/season.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Standings' };

/** This season's standings, which may have no entries yet. */
export const loader = async () => {
  const season = await getCurrentSeason();
  if (!season) throw new Response('No season set up yet', { status: 404 });
  const [results, years] = await Promise.all([
    getStandingsForYear(season.year),
    getFSquaredYears(),
  ]);
  return typedjson({ year: season.year, results, years });
};

export default function FSquaredCurrentStandings() {
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
