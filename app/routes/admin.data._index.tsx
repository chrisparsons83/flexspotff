import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Form, useActionData, useTransition } from '@remix-run/react';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import {
  getNflState,
  syncNflGameWeek,
  syncNflPlayers,
  syncSleeperWeeklyScores,
} from '~/libs/syncs.server';
import { createNflTeams } from '~/models/nflteam.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

type ActionData = {
  formError?: string;
  fieldErrors?: {
    url: string | undefined;
  };
  fields?: {
    url: string;
  };
  message?: string;
};

export const action = async ({ request }: ActionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const action = formData.get('_action');

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  switch (action) {
    case 'resyncNflPlayers': {
      await syncNflPlayers();

      return json<ActionData>({ message: 'NFL Players have been updated.' });
    }
    case 'resyncNflGames': {
      // Set up teams (this needs to be optimized to not do this)
      await createNflTeams();

      // The array one-liner there makes an array of numbers from 1 to 18.
      await syncNflGameWeek(
        currentSeason.year,
        Array.from({ length: 18 }, (_, i) => i + 1),
      );

      return json<ActionData>({ message: 'NFL Games have been updated.' });
    }
    case 'resyncCurrentWeekScores': {
      const nflGameState = await getNflState();

      await syncSleeperWeeklyScores(
        currentSeason.year,
        nflGameState.display_week,
      );

      return json<ActionData>({ message: 'League games have been synced.' });
    }
    case 'resyncCurrentYearScores': {
      for (let i = 1; i <= 17; i++) {
        await syncSleeperWeeklyScores(currentSeason.year, i);
      }

      return json<ActionData>({
        message: 'League games have been synced for the year.',
      });
    }
  }

  return json<ActionData>({ message: 'Nothing was updated.' });
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  return {};
};

export default function AdminDataIndex() {
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  return (
    <>
      <h2>Data Updates</h2>
      <p>This is a good list of things to eventually automate.</p>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST'>
        <section>
          <h3>Update NFL Games</h3>
          <p>
            This will resync all NFL games in the system. This should probably
            be run on Monday nights late or maybe Tuesday morning.
          </p>
          {actionData?.formError ? (
            <p className='form-validation-error' role='alert'>
              {actionData.formError}
            </p>
          ) : null}
          <Button
            type='submit'
            name='_action'
            value='resyncNflGames'
            disabled={transition.state !== 'idle'}
          >
            Resync NFL Games
          </Button>
        </section>
        <section>
          <h3>Update Current Week Scores</h3>
          <p>
            This will resync all current week scores in the system. This can be
            run at any time safely. This does run every minute during when most
            games are normally playing. Weird Saturday games may be the
            exception.
          </p>
          {actionData?.formError ? (
            <p className='form-validation-error' role='alert'>
              {actionData.formError}
            </p>
          ) : null}
          <Button
            type='submit'
            name='_action'
            value='resyncCurrentWeekScores'
            disabled={transition.state !== 'idle'}
          >
            Resync Current Week Scores
          </Button>
        </section>
        <section>
          <h3>Update Current Year Scores</h3>
          <p>
            This will resync all week scores in the system. Only do this once in
            a while, generally the resync current week score should be all you
            need.
          </p>
          {actionData?.formError ? (
            <p className='form-validation-error' role='alert'>
              {actionData.formError}
            </p>
          ) : null}
          <Button
            type='submit'
            name='_action'
            value='resyncCurrentYearScores'
            disabled={transition.state !== 'idle'}
          >
            Resync Current Year Scores
          </Button>
        </section>
        <section>
          <h3>Update NFL Players Database</h3>
          <p>
            This will resync all NFL players in the system. You only really need
            to do this if there's a player that's not showing up for some
            reason. It runs at 10:08 PT daily.
          </p>
          {actionData?.formError ? (
            <p className='form-validation-error' role='alert'>
              {actionData.formError}
            </p>
          ) : null}
          <Button
            type='submit'
            name='_action'
            value='resyncNflPlayers'
            disabled={transition.state !== 'idle'}
          >
            Resync NFL Players
          </Button>
        </section>
      </Form>
    </>
  );
}
