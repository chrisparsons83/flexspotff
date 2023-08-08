import type { LoaderArgs } from "@remix-run/node";
import { Link, Outlet } from "@remix-run/react";

import type { Season } from "~/models/season.server";
import { getCurrentSeason } from "~/models/season.server";
import { getNewestWeekTeamGameByYear } from "~/models/teamgame.server";

import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  teamGameNewestWeek: number;
  currentSeason: Season;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error("No active season currently");
  }

  const teamGameNewestWeek =
    (await getNewestWeekTeamGameByYear(currentSeason.year))._max.week || 1;

  return superjson<LoaderData>(
    {
      teamGameNewestWeek,
      currentSeason,
    },
    { headers: { "x-superjson": "true" } }
  );
};

export default function LeaguesIndex() {
  const { teamGameNewestWeek, currentSeason } =
    useSuperLoaderData<typeof loader>();

  const navigationLinks = [
    {
      name: "Overall Leaderboard",
      href: "/leagues/leaderboard",
      current: false,
    },
    {
      name: "Weekly Leaderboards",
      href: `/leagues/leaderboard/${currentSeason.year}/${teamGameNewestWeek}`,
      current: false,
    },
    { name: "Standings", href: "/leagues/standings", current: false },
    { name: "Cup", href: `/leagues/cup/${currentSeason.year}`, current: false },
    { name: "ADP", href: "/leagues/adp", current: false },
    { name: "Records", href: "/leagues/records", current: false },
    { name: "Rules", href: "/leagues/rules", current: false },
  ];

  return (
    <>
      <h2>FlexSpotFF Leagues</h2>
      <div className="grid md:grid-cols-12 md:gap-4">
        <div className="not-prose text-sm md:col-span-2">
          <section>
            <p
              id="admin-leagues-heading"
              className="mb-3 font-semibold text-slate-900 dark:text-slate-500"
            >
              Leagues
            </p>
            <ul
              aria-labelledby="admin-leagues-heading"
              className="mb-8 space-y-2 p-0"
            >
              {navigationLinks.map((navLink) => (
                <li key={navLink.name} className="flow-root">
                  <Link
                    to={navLink.href}
                    className="block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300"
                  >
                    {navLink.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="md:col-span-10">
          <Outlet />
        </div>
      </div>
    </>
  );
}
