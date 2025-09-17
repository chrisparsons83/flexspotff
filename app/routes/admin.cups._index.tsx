import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, Link, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
import { createCup, getCups } from '~/models/cup.server';
import type { CupWeek } from '~/models/cupweek.server';
import { createCupWeek } from '~/models/cupweek.server';
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

      const cup = await createCup({
        year: currentSeason.year,
      });

      const promises: Promise<CupWeek>[] = [];
      for (let i = 1; i <= 14; i++) {
        promises.push(
          createCupWeek({
            cupId: cup.id,
            week: i,
            mapping: 'PENDING',
          }),
        );
      }
      await Promise.all(promises);

      return typedjson({ message: `${cup.year} Cup has been created` });
    }
  }

  return typedjson({ message: 'Nothing has happened.' });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const cups = await getCups();

  return typedjson({ cups });
};

export default function QBStreamingStandingsYearIndex() {
  const { cups } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <>
      <h2>Cups</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST'>
        <div>
          <Button
            type='submit'
            name='_action'
            value='createNewWeek'
            disabled={navigation.state !== 'idle'}
          >
            Create Cup
          </Button>
        </div>
      </Form>
      <table className='w-full'>
        <thead>
          <tr>
            <th>Year</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cups.map(cup => (
            <tr key={cup.id}>
              <td>{cup.year}</td>
              <td>
                <Link to={`./${cup.id}`}>Administer</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
