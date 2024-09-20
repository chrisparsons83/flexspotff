import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const locksWeeks = await getLocksWeeksByYear(currentSeason.year);

  return typedjson({
    locksWeeks,
  });
};

export default function GamesLocksMyEntries() {
  const { locksWeeks } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <h2>My Entries</h2>
      <ul>
        {locksWeeks.map(locksWeek => {
          const suffix = locksWeek.isWeekScored
            ? ' - Week Scored'
            : !locksWeek.isOpen
            ? ' - Not Open'
            : '';

          return (
            <li key={locksWeek.id}>
              <Link to={`./${locksWeek.id}`}>
                Week {locksWeek.weekNumber} {suffix}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
