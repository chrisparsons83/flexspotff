import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { typedjson, useTypedActionData, useTypedLoaderData } from 'remix-typedjson';
import type { DFSSurvivorUserWeek, Season } from '@prisma/client';
import { getCurrentSeason } from '~/models/season.server';
import { getDfsSurvivorWeeksByYear } from '~/models/dfssurvivorweek.server';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import { authenticator, requireAdmin } from '~/services/auth.server';

type LoaderData = {
  dfsSurvivorWeeks: DFSSurvivorUserWeek[];
  currentSeason: Season;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const _action = formData.get('_action');

  if (_action === 'createNewWeek') {
    const currentSeason = await getCurrentSeason();
    if (!currentSeason) {
      throw new Error('No active season currently');
    }
  }

  return typedjson({ message: 'Invalid action' });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  try {
    const dfsSurvivorWeeks = await getDfsSurvivorWeeksByYear(currentSeason.year);
    return typedjson<LoaderData>({ dfsSurvivorWeeks, currentSeason });
  } catch (error) {
    console.error('Error fetching DFS Survivor weeks:', error);
    throw new Error('Failed to fetch DFS Survivor weeks');
  }
};

export default function AdminDfsSurvivorIndex() {
  const { dfsSurvivorWeeks } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();

  return (
    <>
      <h2>DFS Survivor</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST'>
      </Form>
      <table className='w-full'>
        <thead>
          <tr>
            <th>Week</th>
            <th>Scored</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {dfsSurvivorWeeks.map((week: DFSSurvivorUserWeek) => (
            <tr key={week.id}>
              <td>{week.week}</td>
              <td>{week.isScored ? 'Yes' : 'No'}</td>
              <td>
                <Button
                  type='button'
                  onClick={() => {
                    // TODO: Implement scoring functionality
                  }}
                >
                  Score Week
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
} 