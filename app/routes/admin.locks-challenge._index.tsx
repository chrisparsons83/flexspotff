import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import { syncNflGameWeek } from '~/libs/syncs.server';
import type { LocksGameCreate } from '~/models/locksgame.server';
import {
  getLocksGamesByYearAndWeek,
  upsertLocksGame,
} from '~/models/locksgame.server';
import {
  deleteLocksGamePicksNotActive,
  updateLocksGamePicksWithResults,
} from '~/models/locksgamepicks.server';
import {
  createLocksWeek,
  getLocksWeekByYearAndWeek,
  getLocksWeeksByYear,
  getNewestLocksWeekForYear,
  updateLocksWeek,
} from '~/models/locksweek.server';
import { getWeekNflGames } from '~/models/nflgame.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { areAllNflGamesComplete } from '~/utils/helpers';

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const action = formData.get('_action');

  switch (action) {
    case 'createNewWeek': {
      let currentSeason = await getCurrentSeason();
      if (!currentSeason) {
        throw new Error('No active season currently');
      }

      // Get max week of season, then add one
      const latestWeek = await getNewestLocksWeekForYear(currentSeason.year);
      const newWeek = latestWeek ? latestWeek.weekNumber + 1 : 1;

      // Create new LocksWeek
      await createLocksWeek({
        year: currentSeason.year,
        weekNumber: newWeek,
        isOpen: false,
        isWeekScored: false,
      });

      return typedjson({ message: 'Week has been created' });
    }
    case 'scoreWeek': {
      const weekNumberString = formData.get('weekNumber');
      const yearString = formData.get('year');

      if (
        typeof weekNumberString !== 'string' ||
        typeof yearString !== 'string'
      ) {
        throw new Error('Form has not been formed correctly');
      }

      const year = Number(yearString);
      const weekNumber = Number(weekNumberString);

      const locksWeek = await getLocksWeekByYearAndWeek(+year, +weekNumber);
      if (!locksWeek) throw new Error(`There's no locks week here`);

      // Update NFL scores for the week
      await syncNflGameWeek(year, [weekNumber]);

      // Check if all NFL games for the week are completed
      const allGamesCompleted = await areAllNflGamesComplete(year, weekNumber);
      if (!allGamesCompleted) {
        return typedjson({
          message: 'Not all games have been completed, scoring cannot proceed',
        });
      }

      // Loop through each game and process
      const locksGames = await getLocksGamesByYearAndWeek(year, weekNumber);
      const locksGamePickPromises: Promise<number | [number, number]>[] = [];
      for (const locksGame of locksGames) {
        locksGamePickPromises.push(updateLocksGamePicksWithResults(locksGame));
      }
      await Promise.all(locksGamePickPromises);

      const locksGameDeletePromises: Promise<any>[] = [];
      for (const locksGame of locksGames) {
        locksGameDeletePromises.push(deleteLocksGamePicksNotActive(locksGame));
      }
      await Promise.all(locksGameDeletePromises);

      await updateLocksWeek({
        ...locksWeek,
        isWeekScored: true,
      });

      return typedjson({ message: 'Week has been scored' });
    }
    case 'publishWeek': {
      const weekNumberString = formData.get('weekNumber');
      const yearString = formData.get('year');

      if (
        typeof weekNumberString !== 'string' ||
        typeof yearString !== 'string'
      ) {
        throw new Error('Form has not been formed correctly');
      }

      const year = Number(yearString);
      const weekNumber = Number(weekNumberString);

      const locksWeek = await getLocksWeekByYearAndWeek(+year, +weekNumber);
      if (!locksWeek) throw new Error(`There's no locks week here`);

      // Create LocksGames for the week
      const nflGames = await getWeekNflGames(+year, +weekNumber);
      const promises: Promise<any>[] = [];
      for (const nflGame of nflGames) {
        const locksGame: LocksGameCreate = {
          gameId: nflGame.id,
          locksWeekId: locksWeek.id,
        };
        promises.push(upsertLocksGame(locksGame));
      }
      await Promise.all(promises);

      await updateLocksWeek({
        ...locksWeek,
        isOpen: true,
      });

      return typedjson({ message: 'Week has been published' });
    }
  }

  return typedjson({ message: 'Nothing has happened.' });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const locksWeeks = await getLocksWeeksByYear(currentSeason.year);

  return typedjson({ locksWeeks });
};

export default function SpreadLocksList() {
  const { locksWeeks } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <div>
      <h2>Locks Challenge Lines by Week</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST'>
        <div>
          <Button
            type='submit'
            name='_action'
            value='createNewWeek'
            disabled={navigation.state !== 'idle'}
          >
            Create Next Week
          </Button>
        </div>
      </Form>
      <table className='w-full'>
        <thead>
          <tr>
            <th>Week</th>
            <th>Published?</th>
            <th>Scored?</th>
            <th>Publish Week?</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {locksWeeks.map(locksWeek => (
            <tr key={locksWeek.id}>
              <td>{locksWeek.weekNumber}</td>
              <td>{locksWeek.isOpen ? 'Yes' : 'No'}</td>
              <td>{locksWeek.isWeekScored ? 'Yes' : 'No'}</td>
              <td>
                <Form method='POST'>
                  <input
                    type='hidden'
                    name='weekNumber'
                    value={locksWeek.weekNumber}
                  />
                  <input type='hidden' name='year' value={locksWeek.year} />
                  <Button
                    type='submit'
                    name='_action'
                    value='publishWeek'
                    disabled={navigation.state !== 'idle'}
                  >
                    Publish Week
                  </Button>
                </Form>
              </td>
              <td>
                <Form method='POST'>
                  <input
                    type='hidden'
                    name='weekNumber'
                    value={locksWeek.weekNumber}
                  />
                  <input type='hidden' name='year' value={locksWeek.year} />
                  <Button
                    type='submit'
                    name='_action'
                    value='scoreWeek'
                    disabled={navigation.state !== 'idle'}
                  >
                    Score Week
                  </Button>
                </Form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
