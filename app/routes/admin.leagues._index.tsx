import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import { syncLeague } from '~/libs/league-sync.server';
import { getLeague, getLeagues } from '~/models/league.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();

  const action = formData.get('action');
  const leagueId = formData.get('leagueId');

  if (typeof action !== 'string' || typeof leagueId !== 'string') {
    throw new Error(`Form not generated correctly.`);
  }

  const league = await getLeague(leagueId);
  if (!league) {
    throw new Error(`League does not exist`);
  }

  switch (action) {
    case 'sync': {
      await syncLeague(league);
      break;
    }
    default: {
      throw new Error(`Action not supported`);
    }
  }

  return typedjson({
    message: `${league.year} ${league.name} League has been synced.`,
  });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const leagues = await getLeagues();

  return typedjson({ leagues });
};

export default function LeaguesList() {
  const { leagues } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();

  return (
    <>
      <h2>League List</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <table className='w-full'>
        <thead>
          <tr>
            <th>Year</th>
            <th>Name</th>
            <th>Tier</th>
            <th>Sleeper Link</th>
            <th>Draft Link</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {leagues.map(league => (
            <tr key={league.id}>
              <td>{league.year}</td>
              <td>{league.name}</td>
              <td>{league.tier}</td>
              <td>
                <a
                  href={`https://sleeper.com/leagues/${league.sleeperLeagueId}`}
                >
                  Sleeper
                </a>
              </td>
              <td>
                <a
                  href={`https://sleeper.com/draft/nfl/${league.sleeperDraftId}`}
                >
                  Draft ({league.teams.length} / 12)
                </a>
                <br />
                {league.draftDateTime?.toLocaleString() || ''}
              </td>
              <td className='not-prose'>
                <Form method='POST'>
                  <input type='hidden' name='leagueId' value={league.id} />
                  <Button type='submit' name='action' value='sync'>
                    Sync
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
