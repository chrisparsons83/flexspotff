import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from '@remix-run/react';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  getNflState,
  syncNflGameWeek,
  syncNflPlayers,
  syncSleeperWeeklyScores,
} from '~/libs/syncs.server';
import { createNflTeams } from '~/models/nflteam.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { FIRST_YEAR } from '~/utils/constants';

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

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const action = formData.get('_action');
  const year = Number(formData.get('year'));

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
      if (year < FIRST_YEAR || year > currentSeason.year) {
        throw new Error('Invalid year entered');
      }
      for (let i = 1; i <= 17; i++) {
        await syncSleeperWeeklyScores(year, i);
      }

      return json<ActionData>({
        message: `League games have been synced for ${year}.`,
      });
    }
  }

  return json<ActionData>({ message: 'Nothing was updated.' });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No current season');
  }

  return { currentSeason };
};

export default function AdminDataIndex() {
  const { currentSeason } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();

  const yearArray = Array.from(
    { length: currentSeason.year - FIRST_YEAR + 1 },
    (_, i) => FIRST_YEAR + i,
  ).reverse();

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
            disabled={navigation.state !== 'idle'}
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
            disabled={navigation.state !== 'idle'}
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
          <div className='flex flex-start gap-4'>
            <div>
              <Select name='year'>
                <SelectTrigger>
                  <SelectValue placeholder='Select a year' />
                </SelectTrigger>
                <SelectContent>
                  {yearArray.map(year => (
                    <SelectItem value={year.toString()} key={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type='submit'
              name='_action'
              value='resyncCurrentYearScores'
              disabled={navigation.state !== 'idle'}
            >
              Resync Current Year Scores
            </Button>
          </div>
        </section>
        <section>
          <h3>Update NFL Players Database</h3>
          <p>
            This will resync all NFL players in the system. You only really need
            to do this if there's a player that's not showing up for some
            reason.
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
            disabled={navigation.state !== 'idle'}
          >
            Resync NFL Players
          </Button>
        </section>
      </Form>
    </>
  );
}
