import type { ActionArgs, LoaderArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import Button from '~/components/ui/Button';
import type { Registration } from '~/models/registration.server';
import {
  createRegistration,
  getRegistrationByUserAndYear,
  getRegistrationsByYear,
} from '~/models/registration.server';
import type { Season } from '~/models/season.server';
import { getCurrentSeason } from '~/models/season.server';
import type { User } from '~/models/user.server';
import { authenticator } from '~/services/auth.server';
import { superjson, useSuperLoaderData } from '~/utils/data';

type ActionData = {
  formError?: string;
  registration?: Registration;
};

type LoaderData = {
  user: User;
  registration: Registration | null;
  registrationsCount: number;
  currentSeason: Season;
};

export const action = async ({
  request,
}: ActionArgs): Promise<Response | ActionData> => {
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

  return superjson<ActionData>({ registration });
};

export const loader = async ({ request }: LoaderArgs) => {
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

  return superjson<LoaderData>(
    { user, registration, currentSeason, registrationsCount },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function Dashboard() {
  const { registration, currentSeason, registrationsCount } =
    useSuperLoaderData<typeof loader>();

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
