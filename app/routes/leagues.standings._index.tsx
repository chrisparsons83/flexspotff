import type { LoaderArgs } from '@remix-run/node';
import LeagueTable from '~/components/layout/standings/LeagueTable';
import GoBox from '~/components/ui/GoBox';
import { getLeaguesByYear } from '~/models/league.server';
import { getCurrentSeason } from '~/models/season.server';
import { FIRST_YEAR } from '~/utils/constants';
import { superjson, useSuperLoaderData } from '~/utils/data';

type LoaderData = {
  leagues: Awaited<ReturnType<typeof getLeaguesByYear>>;
  maxYear: number;
};

export const loader = async ({ params }: LoaderArgs) => {
  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const leagues = await getLeaguesByYear(currentSeason.year);

  return superjson<LoaderData>(
    { leagues, maxYear: currentSeason.year },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function Standings() {
  const { leagues, maxYear } = useSuperLoaderData<typeof loader>();

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
