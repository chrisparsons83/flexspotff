import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/FlexSpotButton';
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
    <>
      <h2 className='mt-0'>Registration List</h2>
      {actionData?.message && (
        <Alert message={actionData.message} status={actionData.status} />
      )}
      <ol>
        {registrations.map(registration => (
          <li key={registration.id}>
            {registration.user.discordName}
            <span className='not-prose ml-2'>
              <Form
                method='POST'
                style={{ display: 'inline' }}
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
                  className='bg-red-100 text-red-900 hover:bg-red-200'
                >
                  Remove
                </Button>
              </Form>
            </span>
          </li>
        ))}
      </ol>
      <h3>Missing from last year</h3>
      <ul>
        {notYetSignedUp.map(registration => (
          <li key={registration.id}>{registration.user.discordName}</li>
        ))}
      </ul>
      <h3>Missing from two years ago</h3>
      <ul>
        {twoYearsAgoNotSignedUp.map(registration => (
          <li key={registration.id}>{registration.user.discordName}</li>
        ))}
      </ul>
    </>
  );
}
