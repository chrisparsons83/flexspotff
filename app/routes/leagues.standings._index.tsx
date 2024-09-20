import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import LeagueTable from '~/components/layout/standings/LeagueTable';
import GoBox from '~/components/ui/GoBox';
import { getLeaguesByYear } from '~/models/league.server';
import { getCurrentSeason } from '~/models/season.server';
import { FIRST_YEAR } from '~/utils/constants';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const leagues = await getLeaguesByYear(currentSeason.year);

  return typedjson({ leagues, maxYear: currentSeason.year });
};

export default function Standings() {
  const { leagues, maxYear } = useTypedLoaderData<typeof loader>();

  const yearArray = Array.from(
    { length: maxYear - FIRST_YEAR + 1 },
    (_, i) => FIRST_YEAR + i,
  )
    .reverse()
    .map(yearNumber => ({
      label: `${yearNumber}`,
      url: `/leagues/standings/${yearNumber}`,
    }));

  return (
    <>
      <h2>League Standings</h2>

      <div className='float-right mb-4'>
        <GoBox options={yearArray} buttonText='Choose Year' />
      </div>

      {leagues.map(league => (
        <LeagueTable key={league.id} league={league} />
      ))}
    </>
  );
}
