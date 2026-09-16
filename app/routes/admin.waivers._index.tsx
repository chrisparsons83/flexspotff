import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from '@remix-run/react';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import {
  leagueWaiverChannelIds,
  postWaiverReports,
} from '~/libs/waiver-report.server';
import { syncLeagueWaivers } from '~/libs/waiver-sync.server';
import { getLeaguesByYear } from '~/models/league.server';
import { getCurrentSeason } from '~/models/season.server';
import {
  getWaiverReportsByYear,
  getWaiverTransactions,
} from '~/models/waiver.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import type { Leagues } from '~/utils/constants';
import { isLeagueName } from '~/utils/constants';

type ActionData = {
  message?: string;
  error?: string;
};

const getSeasonLeagues = async (year: number) => {
  const leagues = await getLeaguesByYear(year);
  return leagues.filter(league => isLeagueName(league.name.toLowerCase()));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  // The admin layout only requires an editor and does not guard child actions,
  // so guard here as well as in the loader.
  requireAdmin(user);

  const formData = await request.formData();
  const action = formData.get('_action');
  const year = Number(formData.get('year'));
  const week = Number(formData.get('week'));

  if (!year || !week) {
    return json<ActionData>({ error: 'Year and week are required' });
  }

  try {
    switch (action) {
      case 'sync': {
        const leagues = await getSeasonLeagues(year);
        let total = 0;
        for (const league of leagues) {
          const synced = await syncLeagueWaivers(league, { week });
          total += synced?.rows.length ?? 0;
        }
        return json<ActionData>({
          message: `Synced ${total} waiver claim(s) for week ${week}. Note this replaces what was stored, and Sleeper drops failed claims from older weeks.`,
        });
      }
      case 'post': {
        const results = await postWaiverReports({
          year,
          week,
          force: true,
        });
        const summary = results
          .map(result => `${result.leagueName}: ${result.status}`)
          .join(', ');
        return json<ActionData>({
          message: `Week ${week} - ${summary}`,
        });
      }
      default: {
        return json<ActionData>({ error: 'Invalid action' });
      }
    }
  } catch (error) {
    console.error('Waiver admin action error:', error);
    return json<ActionData>({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const url = new URL(request.url);
  const season = await getCurrentSeason();
  const year = Number(url.searchParams.get('year')) || season?.year || 0;
  const week = Number(url.searchParams.get('week')) || 1;

  const leagues = await getSeasonLeagues(year);
  const reports = await getWaiverReportsByYear(year);

  // Each league posts to its own channel, so the warning names the leagues that
  // have nowhere to post rather than a single missing setting.
  const channelIds = leagueWaiverChannelIds();
  const unconfiguredLeagues = leagues
    .filter(league => !channelIds[league.name.toLowerCase() as Leagues])
    .map(league => league.name);

  const byLeague = await Promise.all(
    leagues.map(async league => ({
      league: { id: league.id, name: league.name },
      report:
        reports.find(
          report => report.leagueId === league.id && report.week === week,
        ) ?? null,
      transactions: await getWaiverTransactions(league.id, week),
    })),
  );

  return json({
    year,
    week,
    byLeague,
    unconfiguredLeagues,
  });
};

export default function AdminWaiversIndex() {
  const { year, week, byLeague, unconfiguredLeagues } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const [, setSearchParams] = useSearchParams();

  const isRunning = navigation.state !== 'idle';
  // Only dead when nothing can post; a single unmapped league still leaves the
  // other four worth posting.
  const nothingToPostTo =
    byLeague.length === 0 || unconfiguredLeagues.length === byLeague.length;

  return (
    <>
      <h2>Waiver Reports</h2>
      <p>
        Inspect the stored waiver claims behind the weekly report each league
        gets in its own channel, and re-run a week without waiting for
        Wednesday.
      </p>

      {actionData?.message && <Alert message={actionData.message} />}
      {actionData?.error && <Alert message={actionData.error} />}
      {unconfiguredLeagues.length > 0 && (
        <Alert
          message={`No waiver channel is configured for ${unconfiguredLeagues.join(
            ', ',
          )}, so posting is disabled for ${
            unconfiguredLeagues.length === 1 ? 'that league' : 'those leagues'
          }.`}
        />
      )}

      <Form
        method='GET'
        className='my-4 flex gap-4 items-end'
        onChange={event =>
          // Explicit pairs, not the FormData itself: createSearchParams falls
          // through to Object.keys for anything it does not special-case, and a
          // FormData's entries are not own properties - so passing it straight in
          // navigates with an empty query string and silently resets the filters.
          setSearchParams(
            Array.from(
              new FormData(event.currentTarget),
              ([key, value]) => [key, String(value)] as [string, string],
            ),
          )
        }
      >
        <div>
          <label htmlFor='year' className='block text-sm'>
            Year
          </label>
          <input
            type='number'
            id='year'
            name='year'
            defaultValue={year}
            className='text-gray-900 rounded px-2 py-1'
          />
        </div>
        <div>
          <label htmlFor='week' className='block text-sm'>
            Week
          </label>
          <input
            type='number'
            id='week'
            name='week'
            min={1}
            max={18}
            defaultValue={week}
            className='text-gray-900 rounded px-2 py-1'
          />
        </div>
        <Button type='submit'>Show</Button>
      </Form>

      <Form method='POST' className='my-4 flex gap-2'>
        <input type='hidden' name='year' value={year} />
        <input type='hidden' name='week' value={week} />
        <Button type='submit' name='_action' value='sync' disabled={isRunning}>
          Sync from Sleeper
        </Button>
        <Button
          type='submit'
          name='_action'
          value='post'
          disabled={isRunning || nothingToPostTo}
        >
          Post to Discord
        </Button>
      </Form>

      {byLeague.map(({ league, report, transactions }) => (
        <section key={league.id} className='my-6'>
          <h3>
            {league.name} — week {week}{' '}
            <span className='text-sm font-normal text-gray-500'>
              {report
                ? `posted ${new Date(report.postedAt).toLocaleString()}`
                : 'not posted'}
            </span>
          </h3>
          {transactions.length === 0 ? (
            <p className='text-sm text-gray-500'>No stored claims.</p>
          ) : (
            <table className='w-full text-sm'>
              <thead>
                <tr>
                  <th className='text-left'>Player</th>
                  <th className='text-left'>Manager</th>
                  <th className='text-right'>Bid</th>
                  <th className='text-right'>Seq</th>
                  <th className='text-left'>Status</th>
                  <th className='text-left'>Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(transaction => (
                  <tr key={transaction.id}>
                    <td>
                      {transaction.addPlayer?.fullName ??
                        `(${transaction.addSleeperId})`}
                    </td>
                    <td>
                      {transaction.user?.discordName ??
                        `unlinked ${transaction.sleeperOwnerId}`}
                    </td>
                    <td className='text-right'>${transaction.bid}</td>
                    <td className='text-right'>{transaction.seq}</td>
                    <td>{transaction.status}</td>
                    <td className='text-xs text-gray-500'>
                      {transaction.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}
