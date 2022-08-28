import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { Form, useTransition } from "@remix-run/react";
import { DateTime } from "luxon";

import { getWeekNflGames } from "~/models/nflgame.server";
import type { PoolGame, PoolGameCreate } from "~/models/poolgame.server";
import { getPoolGamesByYearAndWeek } from "~/models/poolgame.server";
import { upsertPoolGame } from "~/models/poolgame.server";
import {
  getPoolWeekByYearAndWeek,
  updatePoolWeek,
} from "~/models/poolweek.server";

import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

type ActionData = {
  message?: string;
};

type LoaderData = {
  nflGames: Awaited<ReturnType<typeof getWeekNflGames>>;
  poolGames: Awaited<ReturnType<typeof getPoolGamesByYearAndWeek>>;
  poolWeek: Awaited<ReturnType<typeof getPoolWeekByYearAndWeek>>;
};

export const action = async ({ params, request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  // Get pool week data
  const weekNumber = Number(params.week);
  const year = Number(params.year);
  const poolWeek = await getPoolWeekByYearAndWeek(year, weekNumber);
  if (!poolWeek) {
    throw new Error(`This week hasn't been created.`);
  }

  const formData = await request.formData();

  // Create map of games and spreads
  let isOpen = false;
  const spreads: Map<string, number> = new Map();
  for (const [key, value] of formData.entries()) {
    if (key === "isOpen") {
      isOpen = true;
      continue;
    }
    const gameId = key.match(/homeSpread\[(?<gameId>[a-z0-9)]*)\]/);
    if (gameId && gameId.groups?.gameId) {
      spreads.set(gameId.groups?.gameId, Number(value));
    }
  }

  const promises: Promise<PoolGame>[] = [];
  for (const [key, value] of spreads.entries()) {
    const poolGame: PoolGameCreate = {
      gameId: key,
      homeSpread: value,
    };
    promises.push(upsertPoolGame(poolGame));
  }
  await Promise.all(promises);

  await updatePoolWeek({
    ...poolWeek,
    isOpen,
  });

  return superjson<ActionData>(
    { message: "This week has been updated." },
    { headers: { "x-superjson": "true" } }
  );
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const week = Number(params.week);

  // Get pool week
  const poolWeek = await getPoolWeekByYearAndWeek(CURRENT_YEAR, week);

  // Get games
  const nflGames = await getWeekNflGames(CURRENT_YEAR, week);

  // Get existing lines
  const poolGames = await getPoolGamesByYearAndWeek(CURRENT_YEAR, week);

  return superjson<LoaderData>(
    { nflGames, poolGames, poolWeek },
    { headers: { "x-superjson": "true" } }
  );
};

export default function AdminBettingPoolYearWeek() {
  const { nflGames, poolGames, poolWeek } = useSuperLoaderData<typeof loader>();
  const transition = useTransition();

  return (
    <div>
      <h2>Edit Picks for Week {nflGames[0].week}</h2>
      <Form method="post" reloadDocument>
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
                      name={`homeSpread[${game.id}]`}
                      className="dark:border-0 dark:bg-slate-800"
                      defaultValue={
                        poolGames.find(
                          (poolGame) => poolGame.gameId === game.id
                        )?.homeSpread
                      }
                    />
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={3}>
                <input
                  type="checkbox"
                  name="isOpen"
                  checked={poolWeek?.isOpen}
                />{" "}
                Publish week to group
              </td>
            </tr>
          </tbody>
        </table>
        <div>
          <Button type="submit" disabled={transition.state !== "idle"}>
            Update Week
          </Button>
        </div>
      </Form>
    </div>
  );
}
