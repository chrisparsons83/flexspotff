import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { Form, useTransition } from "@remix-run/react";
import { DateTime } from "luxon";

import { getWeekNflGames } from "~/models/nflgame.server";
import type { PoolGame, PoolGameCreate } from "~/models/poolgame.server";
import {
  getPoolGamesByYearAndWeek,
  upsertPoolGame,
} from "~/models/poolgame.server";
import {
  getPoolWeekByYearAndWeek,
  updatePoolWeek,
} from "~/models/poolweek.server";
import { getCurrentSeason } from "~/models/season.server";

import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { superjson, useSuperActionData, useSuperLoaderData } from "~/utils/data";
import Alert from "~/components/ui/Alert";

type ActionData = {
  message?: string;
  updatedNflGames?: Map<string, number>;
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
  const action = formData.get("_action");

  switch (action) {
    case "updateSpreads": {
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
          poolWeekId: poolWeek.id,
        };
        promises.push(upsertPoolGame(poolGame));
      }
      await Promise.all(promises);

      await updatePoolWeek({
        ...poolWeek,
        isOpen,
      });
    }

    return superjson<ActionData>(
      { message: "This week has been updated." },
      { headers: { "x-superjson": "true" } }
    );
  
    case "getSpreads": {
      
      // Call the API to get the spreads for each game
      // const response = await fetch("API_ENDPOINT");
      // const apiData = await response.json();
      const apiData = [
        {
          "id": "42db668449664943833b5c04a583328a",
          "sport_key": "americanfootball_nfl",
          "sport_title": "NFL",
          "commence_time": "2023-09-08T00:21:00Z",
          "home_team": "Kansas City Chiefs",
          "away_team": "Baltimore Ravens",
          "bookmakers": [
            {
              "key": "fanduel",
              "title": "FanDuel",
              "last_update": "2023-07-18T07:38:01Z",
              "markets": [
                {
                  "key": "spreads",
                  "last_update": "2023-07-18T07:38:01Z",
                  "outcomes": [
                    {"name": "Baltimore Ravens", "price": -105, "point": 6.5},
                    {"name": "Kansas City Chiefs", "price": -115, "point": -6.5}
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": "42db668449664943833b5c04a583328a",
          "sport_key": "americanfootball_nfl",
          "sport_title": "NFL",
          "commence_time": "2023-09-08T00:21:00Z",
          "home_team": "Green Bay Packers",
          "away_team": "Philadelphia Eagles",
          "bookmakers": [
            {
              "key": "fanduel",
              "title": "FanDuel",
              "last_update": "2023-07-18T07:38:01Z",
              "markets": [
                {
                  "key": "spreads",
                  "last_update": "2023-07-18T07:38:01Z",
                  "outcomes": [
                    {"name": "Green Bay Packers", "price": -105, "point": 10.5},
                    {"name": "Philadelphia Eagles", "price": -115, "point": -10.5}
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": "42db668449664943833b5c04a583328a",
          "sport_key": "americanfootball_nfl",
          "sport_title": "NFL",
          "commence_time": "2023-09-08T00:21:00Z",
          "home_team": "Indianapolis Colts",
          "away_team": "Houston Texans",
          "bookmakers": [
            {
              "key": "fanduel",
              "title": "FanDuel",
              "last_update": "2023-07-18T07:38:01Z",
              "markets": [
                {
                  "key": "spreads",
                  "last_update": "2023-07-18T07:38:01Z",
                  "outcomes": [
                    {"name": "Houston Texans", "price": -105, "point": 2.5},
                    {"name": "Indianapolis Colts", "price": -115, "point": -2.5}
                  ]
                }
              ]
            }
          ]
        }
        // Add more games as needed
      ];

      // Create a map of team names to their spread points
      const spreadMapping = new Map<string, number>();
      apiData.forEach((game) => {
        const fanduel = game.bookmakers.find((b) => b.key === "fanduel");
        if (fanduel) {
          const spreadMarket = fanduel.markets.find((m) => m.key === "spreads");
          if (spreadMarket) {
        spreadMarket.outcomes.forEach((outcome) => {
          spreadMapping.set(outcome.name as string, outcome.point);
        });
          }
        }
      });

      return superjson<ActionData>(
         { message: "Game spreads have been populated.",
           updatedNflGames: spreadMapping },
         { headers: { "x-superjson": "true" } }
      );
    }
  }
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

  // Get pool week
  const poolWeek = await getPoolWeekByYearAndWeek(currentSeason.year, week);

  // Get games
  const nflGames = await getWeekNflGames(currentSeason.year, week);

  // Get existing lines
  const poolGames = await getPoolGamesByYearAndWeek(currentSeason.year, week);

  return superjson<LoaderData>(
    { nflGames, poolGames, poolWeek },
    { headers: { "x-superjson": "true" } }
  );
};

export default function AdminSpreadPoolYearWeek() {
  const { nflGames, poolGames, poolWeek } = useSuperLoaderData<typeof loader>();
  const actionData = useSuperActionData<ActionData>()
  const transition = useTransition();
  //console.log(nflGames);
  //console.log(actionData?.updatedNflGames?.get('Baltimore Ravens') ?? "No data");
  return (
    <div>
      <h2>Edit Picks for Week {nflGames[0].week}</h2>
      {actionData?.message && <Alert message={actionData.message} />}
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
                        actionData?.updatedNflGames?.get(game.homeTeam.name) ? 
                          actionData?.updatedNflGames?.get(game.homeTeam.name) :
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
                <label htmlFor="isOpen">
                  <input
                    type="checkbox"
                    name="isOpen"
                    id="isOpen"
                    defaultChecked={poolWeek?.isOpen}
                  />{" "}
                  Publish week to group
                </label>
              </td>
            </tr>
          </tbody>
        </table>
        <div>
          <Button 
            type="submit" 
            name="_action"
            value="updateSpreads"
            disabled={transition.state !== "idle"}>
            Update Week
          </Button>
          <span style={{ marginRight: "10px" }}></span>
          <Button 
            type="submit" 
            name="_action" 
            value="getSpreads"
            disabled={transition.state !== "idle"}>
            Get Spreads
          </Button>
        </div>
      </Form>
    </div>
  );
}