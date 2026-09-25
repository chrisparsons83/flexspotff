import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import { scoreQbStats } from '~/libs/qb-streaming/scoring';
import { getWeeklyStats } from '~/libs/sleeper/api.server';
import { syncNflGameWeek } from '~/libs/syncs.server';
import {
  createQBStreamingWeek,
  getQBStreamingWeek,
  getQBStreamingWeeks,
  updateQBStreamingWeek,
} from '~/models/qbstreamingweek.server';
import type { QBStreamingWeekOption } from '~/models/qbstreamingweekoption.server';
import { updateQBStreamingWeekOptionScore } from '~/models/qbstreamingweekoption.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { areAllNflGamesComplete } from '~/utils/helpers';

export const action = async ({ request }: ActionFunctionArgs) => {
  // The admin layout only requires an editor, and layout loaders do not guard
  // child actions, so this has to check for admin itself.
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
      const latestWeek = await getQBStreamingWeeks(currentSeason.year);
      const newWeek = latestWeek.length > 0 ? latestWeek[0].week + 1 : 1;

      // Create new PoolWeek
      await createQBStreamingWeek({
        year: currentSeason.year,
        week: newWeek,
        isOpen: false,
        isScored: false,
      });

      return typedjson({ message: 'Week has been created.' });
    }
    case 'scoreWeek': {
      const weekNumberString = formData.get('weekNumber');
      const yearString = formData.get('year');
      const id = formData.get('id');

      if (
        typeof weekNumberString !== 'string' ||
        typeof yearString !== 'string' ||
        typeof id !== 'string'
      ) {
        throw new Error('Form has not been formed correctly');
      }

      const qbStreamingWeek = await getQBStreamingWeek(id);
      if (!qbStreamingWeek) throw new Error('QB Streaming Week not found');

      const year = Number(yearString);
      const weekNumber = Number(weekNumberString);

      // Update NFL scores for the week
      await syncNflGameWeek(year, [weekNumber]);

      // Check if all NFL games for the week are completed
      const allGamesCompleted = await areAllNflGamesComplete(year, weekNumber);
      if (!allGamesCompleted) {
        return typedjson({
          message: 'Not all games have been completed, scoring cannot proceed',
        });
      }

      const sleeperJson = await getWeeklyStats(year, weekNumber, ['QB']);
      const promises: Promise<QBStreamingWeekOption>[] = [];
      for (const qbStreamingOption of qbStreamingWeek.QBStreamingWeekOptions) {
        const stats = sleeperJson[qbStreamingOption.player.sleeperId] || {};
        const score = scoreQbStats(stats);
        promises.push(
          updateQBStreamingWeekOptionScore(qbStreamingOption.id, score),
        );
      }
      await Promise.all(promises);

      await updateQBStreamingWeek({
        id: qbStreamingWeek.id,
        isOpen: qbStreamingWeek.isOpen,
        isScored: true,
        year: qbStreamingWeek.year,
        week: qbStreamingWeek.week,
      });

      return typedjson({ message: 'Week has been scored.' });
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

  const qbStreamingWeeks = await getQBStreamingWeeks(currentSeason.year);

  return typedjson({ qbStreamingWeeks });
};

export default function AdminQBStreaming() {
  const { qbStreamingWeeks } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <>
      <h2>QB Streaming</h2>
      <p>
        Seasons before the site ran QB streaming can be brought in from their
        Google Sheets on the <Link to='./import'>import page</Link>.
      </p>
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
            <th>Edit</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {qbStreamingWeeks.map(qbStreamingWeek => (
            <tr key={qbStreamingWeek.id}>
              <td>{qbStreamingWeek.week}</td>
              <td>{qbStreamingWeek.isOpen ? 'Yes' : 'No'}</td>
              <td>{qbStreamingWeek.isScored ? 'Yes' : 'No'}</td>
              <td>
                <Link to={`./${qbStreamingWeek.id}`}>Edit Week</Link>
              </td>
              <td>
                <Form method='POST'>
                  <input
                    type='hidden'
                    name='weekNumber'
                    value={qbStreamingWeek.week}
                  />
                  <input
                    type='hidden'
                    name='year'
                    value={qbStreamingWeek.year}
                  />
                  <input type='hidden' name='id' value={qbStreamingWeek.id} />
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
    </>
  );
}
