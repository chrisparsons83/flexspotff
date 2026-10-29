import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import {
  deleteRegistrationWithDraftPreferences,
  getRegistrationById,
  getRegistrationsByYear,
} from '~/models/registration.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  // The admin layout only requires an editor, and layout loaders do not guard
  // child actions, so this has to check for admin itself.
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const action = formData.get('_action');

  if (typeof action !== 'string') {
    throw new Error(`Form not generated correctly.`);
  }

  switch (action) {
    case 'deleteRegistration': {
      const registrationId = formData.get('registrationId');
      if (typeof registrationId !== 'string') {
        throw new Error(`Form not generated correctly.`);
      }

      const currentSeason = await getCurrentSeason();
      if (!currentSeason) {
        throw new Error('No active season currently');
      }

      const registration = await getRegistrationById(registrationId);
      if (!registration) {
        return typedjson({
          message: 'Registration not found.',
          status: 'error' as const,
        });
      }

      // Only the current season is removable here. The prior-year lists on this
      // page are read-only, so a hand-crafted POST should not get around that.
      if (registration.year !== currentSeason.year) {
        return typedjson({
          message: `Only ${currentSeason.year} registrations can be removed.`,
          status: 'error' as const,
        });
      }

      const deleted = await deleteRegistrationWithDraftPreferences(
        registration.id,
        registration.userId,
        currentSeason.id,
      );

      // Someone else removed them between the lookup and the delete.
      if (!deleted) {
        return typedjson({
          message: 'Registration not found.',
          status: 'error' as const,
        });
      }

      return typedjson({
        message: `${registration.user.discordName} has been removed from the ${currentSeason.year} registration list.`,
        status: 'success' as const,
      });
    }
  }

  return typedjson({
    message: 'Nothing has happened.',
    status: 'error' as const,
  });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  let registrations = await getRegistrationsByYear(currentSeason.year);
  let lastYearRegistrations = await getRegistrationsByYear(
    currentSeason.year - 1,
  );
  let twoYearsAgoRegistrations = await getRegistrationsByYear(
    currentSeason.year - 2,
  );

  let registrationsUserArray = registrations.map(
    registration => registration.userId,
  );
  let notYetSignedUp = lastYearRegistrations.filter(
    registration => !registrationsUserArray.includes(registration.userId),
  );
  let twoYearsAgoNotSignedUp = twoYearsAgoRegistrations.filter(
    registration => !registrationsUserArray.includes(registration.userId),
  );

  return typedjson({ registrations, notYetSignedUp, twoYearsAgoNotSignedUp });
};

export default function RegistrationList() {
  const { registrations, notYetSignedUp, twoYearsAgoNotSignedUp } =
    useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <Section title='Registration list'>
      {actionData?.message && (
        <Alert
          message={actionData.message}
          status={actionData.status}
          className='mb-6'
        />
      )}
      <Table headers={['', 'Member', '']} numericColumns={[0]}>
        {registrations.map((registration, index) => (
          <tr key={registration.id}>
            <td className='w-12 text-right text-muted-foreground'>
              {index + 1}
            </td>
            <td>{registration.user.discordName}</td>
            <td className='text-right'>
              <Form
                method='POST'
                onSubmit={e => {
                  if (
                    !window.confirm(
                      `Remove ${registration.user.discordName} from the registration list? This also clears their draft time preferences.`,
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <input
                  type='hidden'
                  name='registrationId'
                  value={registration.id}
                />
                <Button
                  type='submit'
                  name='_action'
                  value='deleteRegistration'
                  disabled={navigation.state !== 'idle'}
                  variant='destructive'
                  size='sm'
                >
                  Remove
                </Button>
              </Form>
            </td>
          </tr>
        ))}
      </Table>
      <Section as='h3' title='Missing from last year'>
        <ul className='grid gap-1 sm:grid-cols-2 lg:grid-cols-3'>
          {notYetSignedUp.map(registration => (
            <li key={registration.id}>{registration.user.discordName}</li>
          ))}
        </ul>
      </Section>
      <Section as='h3' title='Missing from two years ago'>
        <ul className='grid gap-1 sm:grid-cols-2 lg:grid-cols-3'>
          {twoYearsAgoNotSignedUp.map(registration => (
            <li key={registration.id}>{registration.user.discordName}</li>
          ))}
        </ul>
      </Section>
    </Section>
  );
}
