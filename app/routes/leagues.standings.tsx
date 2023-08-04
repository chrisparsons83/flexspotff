import type { LoaderArgs } from "@remix-run/node";

import { getLeaguesByYear } from "~/models/league.server";

import LeagueTable from "~/components/layout/standings/LeagueTable";
import { superjson, useSuperLoaderData } from "~/utils/data";
import { getCurrentSeason } from "~/models/season.server";

type LoaderData = {
  leagues: Awaited<ReturnType<typeof getLeaguesByYear>>;
};

export const loader = async ({ params }: LoaderArgs) => {
  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error("No active season currently");
  }
  
  const leagues = await getLeaguesByYear(currentSeason.year);

  return superjson<LoaderData>(
    { leagues },
    { headers: { "x-superjson": "true" } }
  );
};

export default function Standings() {
  const { leagues } = useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2>League Standings</h2>
      {leagues.map((league) => (
        <LeagueTable key={league.id} league={league} />
      ))}
    </>
  );
}
