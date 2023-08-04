import type { LoaderArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";

import type { PoolWeek } from "~/models/poolweek.server";
import { getPoolWeeksByYear } from "~/models/poolweek.server";
import { getCurrentSeason } from "~/models/season.server";

import { authenticator } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  poolWeeks: PoolWeek[];
};

export const loader = async ({ params, request }: LoaderArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error("No active season currently");
  }

  const poolWeeks = await getPoolWeeksByYear(currentSeason.year);

  return superjson<LoaderData>(
    {
      poolWeeks,
    },
    { headers: { "x-superjson": "true" } }
  );
};

export default function GamesQBStreamingMyEntries() {
  const { poolWeeks } = useSuperLoaderData<typeof loader>();

  return (
    <>
      <h2>My Entries</h2>
      <ul>
        {poolWeeks.map((poolWeek) => {
          const suffix = poolWeek.isWeekScored
            ? " - Week Scored"
            : !poolWeek.isOpen
            ? " - Not Open"
            : "";

          return (
            <li key={poolWeek.id}>
              <Link to={`./${poolWeek.id}`}>
                Week {poolWeek.weekNumber} {suffix}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
