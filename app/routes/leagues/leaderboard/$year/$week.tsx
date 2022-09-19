import type { LoaderArgs } from "@remix-run/node";
import clsx from "clsx";

import {
  getNewestWeekTeamGameByYear,
  getTeamGamesByYearAndWeek,
} from "~/models/teamgame.server";

import GoBox from "~/components/ui/GoBox";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  leaderboard: Awaited<ReturnType<typeof getTeamGamesByYearAndWeek>>;
  week: number;
  year: number;
  maxWeek: number;
};

export const loader = async ({ params }: LoaderArgs) => {
  const year = Number(params.year);
  const week = Number(params.week);

  const leaderboard = await getTeamGamesByYearAndWeek(year, week);

  const maxWeek =
    (await getNewestWeekTeamGameByYear(CURRENT_YEAR))._max.week || 1;

  return superjson<LoaderData>(
    { leaderboard, week, maxWeek, year },
    { headers: { "x-superjson": "true" } }
  );
};

export default function LeaderboardYearWeek() {
  const { leaderboard, week, maxWeek, year } =
    useSuperLoaderData<typeof loader>();

  const rankColors: Record<string, string> = {
    admiral: "bg-admiral text-gray-900",
    champions: "bg-champions text-gray-900",
    dragon: "bg-dragon text-gray-900",
    galaxy: "bg-galaxy text-gray-900",
    monarch: "bg-monarch text-gray-900",
  };

  const weekArray = Array.from({ length: maxWeek }, (_, i) => i + 1)
    .reverse()
    .map((weekNumber) => ({
      label: `Week ${weekNumber}`,
      url: `/leagues/leaderboard/${year}/${weekNumber}`,
    }));

  return (
    <>
      <h2>Week {week} Leaderboard</h2>

      <div className="float-right mb-4">
        <GoBox options={weekArray} buttonText="Choose Week" />
      </div>

      <table>
        <thead>
          <tr>
            <th></th>
            <th>Player</th>
            <th>Points For</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((position, index) => {
            return (
              <tr
                key={position.teamId}
                className={clsx(
                  index % 2 === 0 ? "bg-gray-900" : "bg-gray-800",
                  "p-2"
                )}
              >
                <td className="pl-1">
                  <div
                    className={clsx(
                      rankColors[position.team.league.name.toLocaleLowerCase()],
                      "mx-auto w-8 h-8 flex justify-center items-center font-bold text-sm"
                    )}
                  >
                    {index + 1}
                  </div>
                </td>
                <td>{position.team.user?.discordName || "Missing user"}</td>
                <td>{position.pointsScored}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
