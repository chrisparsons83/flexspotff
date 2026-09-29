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
  addGuillotineLeague,
  syncGuillotineLeague,
} from '~/libs/guillotine/sync.server';
import {
  deleteGuillotineLeague,
  getGuillotineLeagueById,
  getGuillotineSeasonsForAdmin,
} from '~/models/guillotine.server';
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
          await addGuillotineLeague(sleeperUrl);
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
        const league = await getGuillotineLeagueById(leagueId);
        if (!league) throw new Error('League not found');
        const { warnings, unmatchedTeams } = await syncGuillotineLeague(league);
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
        const league = await deleteGuillotineLeague(leagueId);
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

  const seasons = await getGuillotineSeasonsForAdmin();

  return typedjson({
    seasons: seasons.map(season => ({
      year: season.year,
      leagues: season.leagues.map(league => ({
        id: league.id,
        name: league.name,
        sleeperLeagueId: league.sleeperLeagueId,
        format: league.format,
        isComplete: league.isComplete,
        lastScoredWeek: league.lastScoredWeek,
        lastSyncedAt: league.lastSyncedAt,
        teamCount: league.teams.length,
        unmatchedTeams: league.teams.filter(team => !team.userId).length,
      })),
    })),
  });
};

const FORMAT_LABEL = {
  NATIVE: "Sleeper's guillotine",
  MANUAL: 'Chopped by hand',
} as const;

export default function AdminGuillotineIndex() {
  const { seasons } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';

  return (
    <div>
      <h2>Guillotine Leagues</h2>
      {actionData?.message && (
        <Alert message={actionData.message} status={actionData.status} />
      )}
      {actionData?.warnings?.map(warning => (
        <Alert key={warning} message={warning} status='warning' />
      ))}

      <section className='mb-8'>
        <h3>Add League</h3>
        <p className='text-sm'>
          Paste any guillotine league's Sleeper URL, from any year. The season,
          name and format come from Sleeper, and the whole league is synced
          straight away. Leagues from the current season then keep themselves up
          to date.
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

      {seasons.length === 0 && <p>No guillotine leagues added yet.</p>}

      {seasons.map(season => (
        <section key={season.year} className='mb-8'>
          <h3>{season.year}</h3>
          <table className='w-full'>
            <thead>
              <tr>
                <th className='text-left'>League</th>
                <th className='text-left'>Format</th>
                <th className='text-left'>Status</th>
                <th className='text-left'>Members</th>
                <th className='text-left'>Last Synced</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {season.leagues.map(league => (
                <tr key={league.id}>
                  <td>
                    <Link to={league.id}>{league.name}</Link>
                    <div className='font-mono text-xs opacity-75'>
                      {league.sleeperLeagueId}
                    </div>
                  </td>
                  <td>{FORMAT_LABEL[league.format]}</td>
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
                        <input
                          type='hidden'
                          name='leagueId'
                          value={league.id}
                        />
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
                              `Delete "${league.name}" (${season.year})? It can be added again from its Sleeper URL.`,
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input
                          type='hidden'
                          name='leagueId'
                          value={league.id}
                        />
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
        </section>
      ))}
    </div>
  );
}
