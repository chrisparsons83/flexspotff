import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Form, Link, useActionData, useTransition } from '@remix-run/react';

import type { Cup } from '~/models/cup.server';
import { createCup, getCups } from '~/models/cup.server';
import type { CupWeek } from '~/models/cupweek.server';
import { createCupWeek } from '~/models/cupweek.server';
import { getCurrentSeason } from '~/models/season.server';

import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { superjson, useSuperLoaderData } from '~/utils/data';

type ActionData = {
  formError?: string;
  message?: string;
};

type LoaderData = {
  cups: Cup[];
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

      return json<ActionData>({ message: `${cup.year} Cup has been created` });
    }
  }

  return json<ActionData>({ message: 'Nothing has happened.' });
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const cups = await getCups();

  return superjson<LoaderData>(
    { cups },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function QBStreamingStandingsYearIndex() {
  const { cups } = useSuperLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const transition = useTransition();

  return (
    <>
      <h2>Cups</h2>
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
