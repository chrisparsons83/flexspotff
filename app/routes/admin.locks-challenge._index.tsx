import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { scoreLocksWeek } from '~/libs/side-games/locks.server';
import type { LocksGameCreate } from '~/models/locksgame.server';
import { upsertLocksGame } from '~/models/locksgame.server';
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
        autoManaged: false,
        openAlertedAt: null,
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

      // The same code the Monday-night automation runs, with the admin-only
      // safety of dropping games Sleeper no longer lists for the week.
      const { message } = await scoreLocksWeek(year, weekNumber, {
        removeStaleGames: true,
        byAdmin: true,
      });

      return typedjson({ message });
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
        autoManaged: false,
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
    <Section
      title='Locks Challenge Lines by Week'
      action={
        <Form method='POST'>
          <Button
            type='submit'
            name='_action'
            value='createNewWeek'
            disabled={navigation.state !== 'idle'}
          >
            Create Next Week
          </Button>
        </Form>
      }
    >
      {actionData?.message && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      <Table
        headers={['Week', 'Open', 'Scored', 'Auto-managed', 'Publish', 'Score']}
        primaryColumns={[4, 5]}
      >
        {locksWeeks.map(locksWeek => (
          <tr key={locksWeek.id}>
            <td>{locksWeek.weekNumber}</td>
            <td>{locksWeek.isOpen ? 'Yes' : 'No'}</td>
            <td>{locksWeek.isWeekScored ? 'Yes' : 'No'}</td>
            <td>{locksWeek.autoManaged ? 'Yes' : 'No'}</td>
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
                  Open Week
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
      </Table>
    </Section>
  );
}
