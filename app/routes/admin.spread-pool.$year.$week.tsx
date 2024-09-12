import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { Form, useTransition } from '@remix-run/react';
import { DateTime } from 'luxon';
import { z } from 'zod';

import { getWeekNflGames } from '~/models/nflgame.server';
import type { PoolGame, PoolGameCreate } from '~/models/poolgame.server';
import {
  getPoolGamesByYearAndWeek,
  upsertPoolGame,
} from '~/models/poolgame.server';
import {
  getPoolWeekByYearAndWeek,
  updatePoolWeek,
} from '~/models/poolweek.server';
import { getCurrentSeason } from '~/models/season.server';

import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import { authenticator, requireAdmin } from '~/services/auth.server';
import {
  superjson,
  useSuperActionData,
  useSuperLoaderData,
} from '~/utils/data';

const oddsApiData = z.array(
  z.object({
    id: z.string(),
    sport_key: z.string(),
    sport_title: z.string(),
    commence_time: z.string(),
    home_team: z.string(),
    away_team: z.string(),
    bookmakers: z.array(
      z.object({
        key: z.string(),
        title: z.string(),
        last_update: z.string(),
        markets: z.array(
          z.object({
            key: z.string(),
            outcomes: z.array(
              z.object({
                name: z.string(),
                price: z.number().optional(),
                point: z.number().optional(),
              }),
            ),
          }),
        ),
      }),
    ),
  }),
);

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
    failureRedirect: '/login',
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
  const action = formData.get('_action');

  switch (action) {
    case 'updateSpreads':
      {
        // Create map of games and spreads
        let isOpen = false;
        const spreads: Map<string, number> = new Map();
        for (const [key, value] of formData.entries()) {
          if (key === 'isOpen') {
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
        { message: 'This week has been updated.' },
        { headers: { 'x-superjson': 'true' } },
      );

    case 'getSpreads': {
      //Call the API to get the spreads for each game
      const apiKey = process.env.SPREADS_API_KEY;
      const sportKey = 'americanfootball_nfl';
      const regions = 'us';
      const markets = 'spreads';
      const oddsFormat = 'american';
      const dateFormat = 'iso';
      const bookmakers = 'draftkings';

      if (!apiKey) {
        throw new Error(`SPREADS_API_KEY is missing.`);
      }

      // Get Nfl Games for the current year and week
      const nflGames = await getWeekNflGames(year, weekNumber);

      // Find the earliest starting game in nflGames and latest starting game
      const earliestGame = nflGames.reduce((prev, current) =>
        prev.gameStartTime < current.gameStartTime ? prev : current,
      );
      let latestGame = nflGames.reduce((prev, current) =>
        prev.gameStartTime > current.gameStartTime ? prev : current,
      );

      // Add an hour to the latest game start time cause the API is weird
      const gameStartTime = new Date(latestGame.gameStartTime);
      gameStartTime.setHours(gameStartTime.getHours() + 1);

      // Get the start and end dates for the API call
      const commenceTimeFrom =
        earliestGame.gameStartTime.toISOString().slice(0, -5) + 'Z';
      const commenceTimeTo = gameStartTime.toISOString().slice(0, -5) + 'Z';

      let spreadMapping = new Map<string, number>();

      const newFetch = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?` +
          new URLSearchParams({
            apiKey,
            regions,
            markets,
            oddsFormat,
            dateFormat,
            bookmakers,
            commenceTimeFrom,
            commenceTimeTo,
          }).toString(),
      );
      const odds = oddsApiData.parse(await newFetch.json());

      // odds contains a list of live and upcoming events and odds for different bookmakers.
      // Events are ordered by start time (live events are first)
      // console.log(JSON.stringify(response.data))

      // Check your usage
      // console.log(
      //   "Remaining requests",
      //   response.headers["x-requests-remaining"]
      // );
      // console.log("Used requests", response.headers["x-requests-used"]);

      // Create a map of team names to their spread points
      odds.forEach(game => {
        const draftkings = game.bookmakers.find(b => b.key === 'draftkings');
        if (draftkings) {
          draftkings.markets[0].outcomes.forEach(outcome => {
            spreadMapping.set(outcome.name, outcome.point || 0);
          });
        }
      });

      return superjson<ActionData>(
        {
          message: 'Game spreads have been populated.',
          updatedNflGames: spreadMapping,
        },
        { headers: { 'x-superjson': 'true' } },
      );
    }
  }

  return superjson<ActionData>(
    { message: 'There was an error with something' },
    { headers: { 'x-superjson': 'true' } },
  );
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
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
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function AdminSpreadPoolYearWeek() {
  const { nflGames, poolGames, poolWeek } = useSuperLoaderData<typeof loader>();
  const actionData = useSuperActionData<ActionData>();
  const transition = useTransition();
  //console.log(nflGames);
  //console.log(actionData?.updatedNflGames?.get('Baltimore Ravens') ?? "No data");
  return (
    <div>
      <h2>Edit Picks for Week {nflGames[0].week}</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST' reloadDocument>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Game</th>
              <th>Home Spread</th>
            </tr>
          </thead>
          <tbody>
            {nflGames.map(game => {
              const gameStart = DateTime.fromJSDate(game.gameStartTime);
              return (
                <tr key={game.id}>
                  <td>
                    {gameStart.weekdayShort}{' '}
                    {gameStart.toLocaleString(DateTime.TIME_SIMPLE)}
                  </td>
                  <td>
                    {game.awayTeam.mascot} at {game.homeTeam.mascot}
                  </td>
                  <td>
                    <input
                      type='number'
                      step='0.5'
                      name={`homeSpread[${game.id}]`}
                      className='dark:border-0 dark:bg-slate-800'
                      defaultValue={
                        actionData?.updatedNflGames?.get(game.homeTeam.name)
                          ? actionData?.updatedNflGames?.get(game.homeTeam.name)
                          : poolGames.find(
                              poolGame => poolGame.gameId === game.id,
                            )?.homeSpread
                      }
                    />
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={3}>
                <label htmlFor='isOpen'>
                  <input
                    type='checkbox'
                    name='isOpen'
                    id='isOpen'
                    defaultChecked={poolWeek?.isOpen}
                  />{' '}
                  Publish week to group
                </label>
              </td>
            </tr>
          </tbody>
        </table>
        <div>
          <Button
            type='submit'
            name='_action'
            value='updateSpreads'
            disabled={transition.state !== 'idle'}
          >
            Update Week
          </Button>
          <span style={{ marginRight: '10px' }}></span>
          <Button
            type='submit'
            name='_action'
            value='getSpreads'
            disabled={transition.state !== 'idle'}
          >
            Get Spreads
          </Button>
        </div>
      </Form>
    </div>
  );
}
