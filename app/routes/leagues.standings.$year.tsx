import type { LoaderArgs } from '@remix-run/node';
import LeagueTable from '~/components/layout/standings/LeagueTable';
import GoBox from '~/components/ui/GoBox';
import { getLeaguesByYear } from '~/models/league.server';
import { getCurrentSeason } from '~/models/season.server';
import { FIRST_YEAR } from '~/utils/constants';
import { superjson, useSuperLoaderData } from '~/utils/data';

type LoaderData = {
  leagues: Awaited<ReturnType<typeof getLeaguesByYear>>;
  year: number;
  maxYear: number;
};

export const loader = async ({ params }: LoaderArgs) => {
  const year = Number(params.year);
  const currentSeason = await getCurrentSeason();

  const maxYear = currentSeason?.year || new Date().getFullYear();

  if (year < FIRST_YEAR) {
    throw new Error('Invalid year');
  }

  const leagues = await getLeaguesByYear(year);

  return superjson<LoaderData>(
    { leagues, year, maxYear },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function Standings() {
  const { leagues, year, maxYear } = useSuperLoaderData<typeof loader>();

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
      <h2>{year} League Standings</h2>

      <div className='float-right mb-4'>
        <GoBox options={yearArray} buttonText='Choose Year' />
      </div>

      {leagues.map(league => (
        <LeagueTable key={league.id} league={league} />
      ))}
    </>
  );
}
