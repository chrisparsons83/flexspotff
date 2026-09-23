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
import { getSeasons } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const action = formData.get('_action');

  switch (action) {
    case 'createCup': {
      const year = Number(formData.get('year'));
      const seasons = await getSeasons();
      if (!seasons.some(season => season.year === year)) {
        return typedjson({ message: `There is no ${year} season.` });
      }
      if ((await getCups()).some(cup => cup.year === year)) {
        return typedjson({ message: `The ${year} Cup already exists.` });
      }

      const cup = await createCup({ year });

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

  const [cups, seasons] = await Promise.all([getCups(), getSeasons()]);
  const yearsWithCups = new Set(cups.map(cup => cup.year));
  const availableSeasons = seasons.filter(
    season => !yearsWithCups.has(season.year),
  );

  return typedjson({ cups, availableSeasons });
};

export default function QBStreamingStandingsYearIndex() {
  const { cups, availableSeasons } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <>
      <h2>Cups</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST'>
        <div className='flex items-center gap-2'>
          <select
            name='year'
            aria-label='Year'
            defaultValue={
              availableSeasons.find(season => season.isCurrent)?.year
            }
            className='form-select dark:border-0 dark:bg-slate-800'
          >
            {availableSeasons.map(season => (
              <option value={season.year} key={season.id}>
                {season.year}
              </option>
            ))}
          </select>
          <Button
            type='submit'
            name='_action'
            value='createCup'
            disabled={
              navigation.state !== 'idle' || availableSeasons.length === 0
            }
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
