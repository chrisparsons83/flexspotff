import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { Form, useTransition } from "@remix-run/react";
import { DateTime } from "luxon";

import { getWeekNflGames } from "~/models/nflgame.server";
import type { LocksGame, LocksGameCreate } from "~/models/locksgame.server";
import {
  getLocksGamesByYearAndWeek,
  upsertLocksGame,
} from "~/models/locksgame.server";
import {
  getLocksWeekByYearAndWeek,
  updateLocksWeek,
} from "~/models/locksweek.server";
import { getCurrentSeason } from "~/models/season.server";

import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type ActionData = {
  message?: string;
};

type LoaderData = {
  nflGames: Awaited<ReturnType<typeof getWeekNflGames>>;
  locksGames: Awaited<ReturnType<typeof getLocksGamesByYearAndWeek>>;
  locksWeek: Awaited<ReturnType<typeof getLocksWeekByYearAndWeek>>;
};

export const action = async ({ params, request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  // Get locks week data
  const weekNumber = Number(params.week);
  const year = Number(params.year);
  const locksWeek = await getLocksWeekByYearAndWeek(year, weekNumber);
  if (!locksWeek) {
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

  const promises: Promise<LocksGame>[] = [];
  for (const [key, value] of spreads.entries()) {
    const locksGame: LocksGameCreate = {
      gameId: key,
      homeSpread: value,
      locksWeekId: locksWeek.id,
    };
    promises.push(upsertLocksGame(locksGame));
  }
  await Promise.all(promises);

  await updateLocksWeek({
    ...locksWeek,
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

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error("No active season currently");
  }

  const week = Number(params.week);

  // Get locks week
  const locksWeek = await getLocksWeekByYearAndWeek(currentSeason.year, week);

  // Get games
  const nflGames = await getWeekNflGames(currentSeason.year, week);

  // Get existing lines
  const locksGames = await getLocksGamesByYearAndWeek(currentSeason.year, week);

  return superjson<LoaderData>(
    { nflGames, locksGames, locksWeek },
    { headers: { "x-superjson": "true" } }
  );
};

export default function AdminSpreadLocksYearWeek() {
  const { nflGames, locksGames, locksWeek } = useSuperLoaderData<typeof loader>();
  const transition = useTransition();

  return (
    <div>
      <h2>Edit Picks for Week {nflGames[0].week}</h2>
      <Form method="POST" reloadDocument>
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
                        locksGames.find(
                          (locksGame) => locksGame.gameId === game.id
                        )?.homeSpread
                      }
                    />
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={3}>
                <label htmlFor="isOpen">
                  <input
                    type="checkbox"
                    name="isOpen"
                    id="isOpen"
                    defaultChecked={locksWeek?.isOpen}
                  />{" "}
                  Publish week to group
                </label>
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
