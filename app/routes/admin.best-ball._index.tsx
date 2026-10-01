import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import {
  addBestBallLeague,
  syncBestBallLeague,
} from '~/libs/best-ball/sync.server';
import {
  deleteBestBallLeague,
  getBestBallLeagueById,
  getBestBallLeaguesForAdmin,
} from '~/models/bestball.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

type ActionResult = {
  message: string;
  status: 'success' | 'warning' | 'error';
  warnings?: string[];
};

const unmatchedNote = (count: number) =>
  count > 0
    ? ` ${count} team${
        count === 1 ? ' is' : 's are'
      } not matched to a member yet.`
    : '';

export const action = async ({ request }: ActionFunctionArgs) => {
  // The admin layout only requires an editor, and layout loaders do not guard
  // child actions, so this has to check for admin itself.
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const _action = formData.get('_action');

  try {
    switch (_action) {
      case 'addLeague': {
        const sleeperUrl = formData.get('sleeperUrl');
        if (typeof sleeperUrl !== 'string' || sleeperUrl.trim() === '') {
          return typedjson<ActionResult>({
            message: 'Paste the Sleeper league URL.',
            status: 'error',
          });
        }
        const { league, year, warnings, unmatchedTeams } =
          await addBestBallLeague(sleeperUrl);
        return typedjson<ActionResult>({
          message: `Added "${
            league.name
          }" to ${year} and synced it.${unmatchedNote(unmatchedTeams)}`,
          status:
            warnings.length > 0 || unmatchedTeams > 0 ? 'warning' : 'success',
          warnings,
        });
      }

      case 'syncLeague': {
        const leagueId = formData.get('leagueId');
        if (typeof leagueId !== 'string') throw new Error('Missing league');
        const league = await getBestBallLeagueById(leagueId);
        if (!league) throw new Error('League not found');
        const { warnings, unmatchedTeams } = await syncBestBallLeague(league);
        return typedjson<ActionResult>({
          message: `Synced "${league.name}".${unmatchedNote(unmatchedTeams)}`,
          status:
            warnings.length > 0 || unmatchedTeams > 0 ? 'warning' : 'success',
          warnings,
        });
      }

      case 'deleteLeague': {
        const leagueId = formData.get('leagueId');
        if (typeof leagueId !== 'string') throw new Error('Missing league');
        const league = await deleteBestBallLeague(leagueId);
        if (!league) throw new Error('League not found');
        return typedjson<ActionResult>({
          message: `Deleted "${league.name}".`,
          status: 'success',
        });
      }
    }
  } catch (e) {
    return typedjson<ActionResult>({
      message: e instanceof Error ? e.message : 'Something went wrong',
      status: 'error',
    });
  }

  return typedjson<ActionResult>({
    message: 'No action taken',
    status: 'error',
  });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const leagues = await getBestBallLeaguesForAdmin();

  return typedjson({
    leagues: leagues.map(league => ({
      id: league.id,
      year: league.season.year,
      name: league.name,
      sleeperLeagueId: league.sleeperLeagueId,
      isComplete: league.isComplete,
      lastScoredWeek: league.lastScoredWeek,
      lastSyncedAt: league.lastSyncedAt,
      teamCount: league.teams.length,
      unmatchedTeams: league.teams.filter(team => !team.userId).length,
    })),
  });
};

export default function AdminBestBallIndex() {
  const { leagues } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';

  return (
    <div>
      <h2>Autodraft Best Ball Mania Leagues</h2>
      {actionData?.message && (
        <Alert message={actionData.message} status={actionData.status} />
      )}
      {actionData?.warnings?.map(warning => (
        <Alert key={warning} message={warning} status='warning' />
      ))}

      <section className='mb-8'>
        <h3>Add League</h3>
        <p className='text-sm'>
          Paste the year's Best Ball Mania Sleeper URL, from any year. The
          season and name come from Sleeper, and the whole league - draft and
          weeks 1-17 - is synced straight away. There is one league a season;
          the current season's then keeps itself up to date.
        </p>
        <Form
          key={actionData?.message}
          method='POST'
          className='flex flex-wrap items-end gap-2'
        >
          <div>
            <label htmlFor='sleeperUrl' className='block text-sm'>
              Sleeper League URL
            </label>
            <input
              id='sleeperUrl'
              name='sleeperUrl'
              type='text'
              className='w-96 max-w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-white'
              placeholder='https://sleeper.com/leagues/123456789'
            />
          </div>
          <Button
            type='submit'
            name='_action'
            value='addLeague'
            disabled={isSubmitting}
          >
            {isSubmitting && navigation.formData?.get('_action') === 'addLeague'
              ? 'Adding…'
              : 'Add League'}
          </Button>
        </Form>
      </section>

      {leagues.length === 0 && <p>No best ball leagues added yet.</p>}

      {leagues.length > 0 && (
        <table className='w-full'>
          <thead>
            <tr>
              <th className='text-left'>Year</th>
              <th className='text-left'>League</th>
              <th className='text-left'>Status</th>
              <th className='text-left'>Members</th>
              <th className='text-left'>Last Synced</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leagues.map(league => (
              <tr key={league.id}>
                <td>{league.year}</td>
                <td>
                  <Link to={league.id}>{league.name}</Link>
                  <div className='font-mono text-xs opacity-75'>
                    {league.sleeperLeagueId}
                  </div>
                </td>
                <td>
                  {league.isComplete
                    ? 'Complete'
                    : league.lastScoredWeek > 0
                    ? `Through week ${league.lastScoredWeek}`
                    : 'Not started'}
                </td>
                <td>
                  {league.unmatchedTeams > 0 ? (
                    <Link to={league.id} className='text-yellow-400'>
                      {league.unmatchedTeams} of {league.teamCount} unmatched
                    </Link>
                  ) : (
                    `All ${league.teamCount} matched`
                  )}
                </td>
                <td className='text-sm'>
                  {league.lastSyncedAt
                    ? league.lastSyncedAt.toLocaleString()
                    : 'Never'}
                </td>
                <td>
                  <div className='flex gap-2'>
                    <Form method='POST'>
                      <input type='hidden' name='leagueId' value={league.id} />
                      <Button
                        type='submit'
                        name='_action'
                        value='syncLeague'
                        disabled={isSubmitting}
                      >
                        Sync
                      </Button>
                    </Form>
                    <Form
                      method='POST'
                      onSubmit={e => {
                        if (
                          !window.confirm(
                            `Delete "${league.name}" (${league.year})? It can be added again from its Sleeper URL.`,
                          )
                        ) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type='hidden' name='leagueId' value={league.id} />
                      <Button
                        type='submit'
                        name='_action'
                        value='deleteLeague'
                        disabled={isSubmitting}
                      >
                        Delete
                      </Button>
                    </Form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
