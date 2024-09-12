import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Form, Link, useActionData, useTransition } from '@remix-run/react';

import { getPoolGamesByYearAndWeek } from '~/models/poolgame.server';
import {
  getPoolGamePicksWonLoss,
  getPoolGamesPicksByPoolWeek,
  updatePoolGamePicksWithResults,
} from '~/models/poolgamepicks.server';
import type { PoolWeek } from '~/models/poolweek.server';
import {
  createPoolWeek,
  getNewestPoolWeekForYear,
  getPoolWeekByYearAndWeek,
  getPoolWeeksByYear,
  updatePoolWeek,
} from '~/models/poolweek.server';
import { createPoolWeekMissed } from '~/models/poolweekmissed.server';
import type { Season } from '~/models/season.server';
import { getCurrentSeason } from '~/models/season.server';

import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import { syncNflGameWeek } from '~/libs/syncs.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { superjson, useSuperLoaderData } from '~/utils/data';

type ActionData = {
  formError?: string;
  message?: string;
};

type LoaderData = {
  poolWeeks: PoolWeek[];
  currentSeason: Season;
};

export const action = async ({ request }: ActionArgs) => {
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
      });

      return json<ActionData>({ message: 'Week has been created' });
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
      console.log(year, weekNumber);

      const poolWeek = await getPoolWeekByYearAndWeek(+year, +weekNumber);
      if (!poolWeek) throw new Error(`There's no pool week here`);

      // Update NFL scores for the week
      await syncNflGameWeek(year, [weekNumber]);

      // TODO: Put check in here to cancel the process if all games aren't completed.

      // Add people that did not put in a bet to penalties
      const poolGamePicks = await getPoolGamesPicksByPoolWeek(poolWeek);
      const userIdsThatBet = [
        ...new Set(
          poolGamePicks
            .filter(poolGamePick => poolGamePick.amountBet > 0)
            .map(poolGamePick => poolGamePick.userId),
        ),
      ];
      const existingUserIdsThatDidNotBet = (await getPoolGamePicksWonLoss(year))
        .map(result => result.userId)
        .filter(userId => !userIdsThatBet.includes(userId));

      const poolGameMissedPromises: Promise<any>[] = [];
      for (const userId of existingUserIdsThatDidNotBet) {
        poolGameMissedPromises.push(createPoolWeekMissed(userId, poolWeek.id));
      }
      await Promise.all(poolGameMissedPromises);

      // Loop through each game and process
      const poolGames = await getPoolGamesByYearAndWeek(year, weekNumber);
      const poolGamePickPromises: Promise<number | [number, number]>[] = [];
      for (const poolGame of poolGames) {
        poolGamePickPromises.push(updatePoolGamePicksWithResults(poolGame));
      }
      await Promise.all(poolGamePickPromises);

      await updatePoolWeek({
        ...poolWeek,
        isWeekScored: true,
      });

      return json<ActionData>({ message: 'Week has been scored' });
    }
  }

  return json<ActionData>({ message: 'Nothing has happened.' });
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const poolWeeks = await getPoolWeeksByYear(currentSeason.year);

  return superjson<LoaderData>(
    { poolWeeks, currentSeason },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function SpreadPoolList() {
  const { poolWeeks, currentSeason } = useSuperLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  return (
    <div>
      <h2>Spread Pool Lines by Week</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST'>
        <div>
          {actionData?.formError ? (
            <p className='form-validation-error' role='alert'>
              {actionData.formError}
            </p>
          ) : null}
          <Button
            type='submit'
            name='_action'
            value='createNewWeek'
            disabled={transition.state !== 'idle'}
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
            <th>Edit</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {poolWeeks.map(poolWeek => (
            <tr key={poolWeek.id}>
              <td>{poolWeek.weekNumber}</td>
              <td>{poolWeek.isOpen ? 'Yes' : 'No'}</td>
              <td>{poolWeek.isWeekScored ? 'Yes' : 'No'}</td>
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
                    disabled={transition.state !== 'idle'}
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
