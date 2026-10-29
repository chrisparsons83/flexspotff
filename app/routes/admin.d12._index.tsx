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
import { Input } from '~/components/ui/input';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import {
  createD12Season,
  deleteD12Season,
  getAllD12Seasons,
} from '~/models/d12season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const _action = formData.get('_action');

  switch (_action) {
    case 'createSeason': {
      const yearStr = formData.get('year');
      if (typeof yearStr !== 'string') throw new Error('Year is required');
      const year = Number(yearStr);
      if (isNaN(year)) throw new Error('Year must be a number');
      try {
        await createD12Season(year);
      } catch (e) {
        return typedjson({
          message: e instanceof Error ? e.message : 'Failed to create season',
        });
      }
      return typedjson({ message: `D12 ${year} season created` });
    }

    case 'deleteSeason': {
      const seasonId = formData.get('seasonId');
      if (typeof seasonId !== 'string')
        throw new Error('Season ID is required');
      await deleteD12Season(seasonId);
      return typedjson({ message: 'Season deleted' });
    }
  }

  return typedjson({ message: 'No action taken' });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const seasons = await getAllD12Seasons();
  return typedjson({ seasons });
};

export default function AdminD12Index() {
  const { seasons } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';

  return (
    <Section title='D12 Administration'>
      {actionData?.message && (
        <Alert message={actionData.message} className='mb-6' />
      )}

      <Section as='h3' title='Create Season'>
        <Form method='POST' className='flex items-end gap-3'>
          <Field label='Year'>
            <Input name='year' type='number' placeholder='2025' />
          </Field>
          <Button
            type='submit'
            name='_action'
            value='createSeason'
            disabled={isSubmitting}
          >
            Create Season
          </Button>
        </Form>
      </Section>

      <Section as='h3' title='Seasons'>
        <Table headers={['Year', 'Leagues', '']}>
          {seasons.map(season => (
            <tr key={season.id}>
              <td>{season.year}</td>
              <td>{season.leagues.length}</td>
              <td>
                <div className='flex gap-2'>
                  <Link to={`./${season.id}`}>Administer</Link>
                  <Form
                    method='POST'
                    onSubmit={e => {
                      if (
                        !window.confirm(
                          `Delete ${season.year} season? This cannot be undone.`,
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type='hidden' name='seasonId' value={season.id} />
                    <Button
                      type='submit'
                      name='_action'
                      value='deleteSeason'
                      disabled={isSubmitting}
                    >
                      Delete
                    </Button>
                  </Form>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Section>
    </Section>
  );
}
