import type { LoaderArgs } from "@remix-run/node";

import { getLeaguesByYear } from "~/models/league.server";

import LeagueTable from "~/components/layout/standings/LeagueTable";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  leagues: Awaited<ReturnType<typeof getLeaguesByYear>>;
};

export const loader = async ({ params }: LoaderArgs) => {
  const leagues = await getLeaguesByYear(CURRENT_YEAR);

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
