import type { LoaderArgs } from "@remix-run/node";
import { useTransition } from "@remix-run/react";
import { DateTime } from "luxon";

import { getWeekNflGames } from "~/models/nflgame.server";

import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  nflGames: Awaited<ReturnType<typeof getWeekNflGames>>;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const week = Number(params.week);

  // Get games
  const nflGames = await getWeekNflGames(CURRENT_YEAR, week);

  return superjson<LoaderData>(
    { nflGames },
    { headers: { "x-superjson": "true" } }
  );
};

export default function AdminBettingPoolYearWeek() {
  const { nflGames } = useSuperLoaderData<typeof loader>();
  const transition = useTransition();

  return (
    <div>
      <h2>Edit Picks for Week {nflGames[0].week}</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Game</th>
            <th>Home Spread</th>
          </tr>
        </thead>
        <tbody>
          {nflGames.map((game) => {
            const gameStart = DateTime.fromJSDate(game.gameStartTime);

            return (
              <tr key={game.id}>
                <td>
                  {gameStart.weekdayShort}{" "}
                  {gameStart.toLocaleString(DateTime.TIME_SIMPLE)}
                </td>
                <td>
                  {game.awayTeam.mascot} at {game.homeTeam.mascot}
                </td>
                <td>
                  <input
                    type="number"
                    step="0.5"
                    className="dark:border-0 dark:bg-slate-800"
                  />
                </td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={3}>
              <input type="checkbox" /> Publish week to group
            </td>
          </tr>
        </tbody>
      </table>
      <div>
        <Button type="submit" disabled={transition.state !== "idle"}>
          Update Week
        </Button>
      </div>
    </div>
  );
}
