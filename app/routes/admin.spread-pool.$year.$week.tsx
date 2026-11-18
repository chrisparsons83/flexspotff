import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import { DateTime } from 'luxon';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Checkbox, Input } from '~/components/ui/input';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { fetchSpreadLines } from '~/libs/side-games/pool-odds.server';
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
import { authenticator, requireAdmin } from '~/services/auth.server';

export const action = async ({ params, request }: ActionFunctionArgs) => {
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
          autoManaged: false,
        });
      }

      return typedjson({
        message: 'This week has been updated.',
        updatedNflGames: new Map<string, number>(),
      });

    case 'getSpreads': {
      // Get Nfl Games for the current year and week
      const nflGames = await getWeekNflGames(year, weekNumber);

      // The same fetch the automation uses; a missing key still throws the
      // message this page has always shown.
      const spreadMapping = await fetchSpreadLines(nflGames);

      return typedjson({
        message: 'Game spreads have been populated.',
        updatedNflGames: spreadMapping,
      });
    }
  }

  return typedjson({
    message: 'There was an error with something',
    updatedNflGames: new Map<string, number>(),
  });
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
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

  return typedjson({ nflGames, poolGames, poolWeek });
};

export default function AdminSpreadPoolYearWeek() {
  const { nflGames, poolGames, poolWeek } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <Section title={`Edit Picks for Week ${nflGames[0].week}`}>
      {actionData?.message && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      <Form method='POST' reloadDocument>
        <Table headers={['Date', 'Game', 'Home Spread']}>
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
                  <Input
                    type='number'
                    step='0.5'
                    name={`homeSpread[${game.id}]`}
                    aria-label={`${game.homeTeam.mascot} spread`}
                    className='w-24'
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
        </Table>
        <label className='my-6 flex items-center gap-3'>
          <Checkbox name='isOpen' defaultChecked={poolWeek?.isOpen} />
          Publish Week to Group
        </label>
        <div className='flex flex-wrap gap-3'>
          <Button
            type='submit'
            name='_action'
            value='updateSpreads'
            disabled={navigation.state !== 'idle'}
          >
            Update Week
          </Button>
          <Button
            variant='secondary'
            type='submit'
            name='_action'
            value='getSpreads'
            disabled={navigation.state !== 'idle'}
          >
            Get Spreads
          </Button>
        </div>
      </Form>
    </Section>
  );
}
