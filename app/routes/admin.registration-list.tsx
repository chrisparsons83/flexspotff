import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { getRegistrationsByYear } from '~/models/registration.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator, requireAdmin } from '~/services/auth.server';

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
  const { registrations, notYetSignedUp, twoYearsAgoNotSignedUp } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <h2 className='mt-0'>Registration List</h2>
      <ol>
        {registrations.map(registration => (
          <li key={registration.id}>{registration.user.discordName}</li>
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
