import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import Button from '~/components/ui/Button';
import type { Registration } from '~/models/registration.server';
import {
  createRegistration,
  getRegistrationByUserAndYear,
  getRegistrationsByYear,
} from '~/models/registration.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

type ActionData = {
  formError?: string;
  registration?: Registration;
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<Response | ActionData> => {
  let user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const form = await request.formData();
  const formYear = form.get('year');

  if (typeof formYear !== 'string') {
    return { formError: `Form not submitted correctly` };
  }

  const year = Number.parseInt(formYear, 10);

  let registration = await createRegistration(user.id, year);

  return typedjson({ registration });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  let registration = await getRegistrationByUserAndYear(
    user.id,
    currentSeason?.year,
  );

  let registrations = await getRegistrationsByYear(currentSeason.year);
  const registrationsCount = registrations.length;

  return typedjson({ user, registration, currentSeason, registrationsCount });
};

export default function Dashboard() {
  const { registration, currentSeason, registrationsCount } =
    useTypedLoaderData<typeof loader>();

  const isRegistrationFull =
    currentSeason.registrationSize <= registrationsCount;

  const buttonText = `${
    isRegistrationFull ? 'Join wait list' : 'Register'
  } for ${currentSeason.year} Leagues`;

  return (
    <div>
      <h2>{currentSeason.year} League Registration</h2>
      {registration ? (
        <p>
          Thanks! You signed up at {registration.createdAt.toLocaleString()}
        </p>
      ) : (
        <>
          <p>
            You have not yet registered for the {currentSeason.year} leagues.
          </p>
          {isRegistrationFull && (
            <p>
              The current season is fully subscribed. You can register below for
              the wait list but a spot is not guaranteed.
            </p>
          )}
          {currentSeason.isOpenForRegistration ? (
            <Form method='POST'>
              <input type='hidden' name='year' value={currentSeason.year} />
              <Button type='submit'>{buttonText}</Button>
            </Form>
          ) : (
            <p>Registration is not currently open.</p>
          )}
        </>
      )}
    </div>
  );
}
