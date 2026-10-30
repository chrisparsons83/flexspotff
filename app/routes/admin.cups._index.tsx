import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { NativeSelect } from '~/components/ui/input';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
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
    <Section title='Cups'>
      {actionData?.message && (
        <Alert message={actionData.message} className='mb-6' />
      )}
      <Form method='POST' className='flex items-end gap-3'>
        <Field label='Year' className='w-32'>
          <NativeSelect
            name='year'
            defaultValue={
              availableSeasons.find(season => season.isCurrent)?.year
            }
          >
            {availableSeasons.map(season => (
              <option value={season.year} key={season.id}>
                {season.year}
              </option>
            ))}
          </NativeSelect>
        </Field>
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
      </Form>
      <Section as='h3' title='Cups by Year'>
        <Table headers={['Year', 'Actions']}>
          {cups.map(cup => (
            <tr key={cup.id}>
              <td>{cup.year}</td>
              <td>
                <Link to={`./${cup.id}`}>Administer</Link>
              </td>
            </tr>
          ))}
        </Table>
      </Section>
    </Section>
  );
}
