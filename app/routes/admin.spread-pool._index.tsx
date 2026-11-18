import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { scorePoolWeek } from '~/libs/side-games/pool.server';
import {
  createPoolWeek,
  getNewestPoolWeekForYear,
  getPoolWeekByYearAndWeek,
  getPoolWeeksByYear,
} from '~/models/poolweek.server';
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
      const latestWeek = await getNewestPoolWeekForYear(currentSeason.year);
      const newWeek = latestWeek ? latestWeek.weekNumber + 1 : 1;

      // Create new PoolWeek
      await createPoolWeek({
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

      const poolWeek = await getPoolWeekByYearAndWeek(+year, +weekNumber);
      if (!poolWeek) throw new Error(`There's no pool week here`);

      // The same code the Monday-night automation runs, with the admin-only
      // safety of dropping games Sleeper no longer lists for the week.
      const { message } = await scorePoolWeek(year, weekNumber, {
        removeStaleGames: true,
        byAdmin: true,
      });

      return typedjson({ message });
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

  const poolWeeks = await getPoolWeeksByYear(currentSeason.year);

  return typedjson({ poolWeeks, currentSeason });
};

export default function SpreadPoolList() {
  const { poolWeeks, currentSeason } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <Section
      title='Spread Pool Lines by Week'
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
        headers={[
          'Week',
          'Published',
          'Scored',
          'Auto-managed',
          'Edit',
          'Score',
        ]}
        primaryColumns={[4, 5]}
      >
        {poolWeeks.map(poolWeek => (
          <tr key={poolWeek.id}>
            <td>{poolWeek.weekNumber}</td>
            <td>{poolWeek.isOpen ? 'Yes' : 'No'}</td>
            <td>{poolWeek.isWeekScored ? 'Yes' : 'No'}</td>
            <td>{poolWeek.autoManaged ? 'Yes' : 'No'}</td>
            <td>
              <Link to={`./${currentSeason.year}/${poolWeek.weekNumber}`}>
                Edit Week
              </Link>
            </td>
            <td>
              <Form method='POST'>
                <input
                  type='hidden'
                  name='weekNumber'
                  value={poolWeek.weekNumber}
                />
                <input type='hidden' name='year' value={poolWeek.year} />
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
