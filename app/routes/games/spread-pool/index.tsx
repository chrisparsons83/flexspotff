import type { LoaderArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";

import type { PoolWeek } from "~/models/poolweek.server";
import { getPoolWeeksByYear } from "~/models/poolweek.server";

import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  poolWeeks: PoolWeek[];
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const poolWeeks = await getPoolWeeksByYear(CURRENT_YEAR);

  return superjson<LoaderData>(
    { poolWeeks },
    { headers: { "x-superjson": "true" } }
  );
};

export default function GamesSpreadPoolIndex() {
  const { poolWeeks } = useSuperLoaderData<typeof loader>();
  console.log(poolWeeks);

  return (
    <>
      <h2>Spread Pool</h2>
      <h3>My Entries</h3>
      {poolWeeks.map((poolWeek) => (
        <li key={poolWeek.id}>
          <Link to={`./${poolWeek.year}/${poolWeek.weekNumber}`}>
            Week {poolWeek.weekNumber}
            {!poolWeek.isOpen && ` - Not Open`}
          </Link>
        </li>
      ))}
      <h3>Overall Standings</h3>
    </>
  );
}
