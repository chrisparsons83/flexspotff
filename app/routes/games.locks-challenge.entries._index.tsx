import type { LoaderArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import type { LocksWeek } from '~/models/locksweek.server';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import { superjson, useSuperLoaderData } from '~/utils/data';

type LoaderData = {
  locksWeeks: LocksWeek[];
};

export const loader = async ({ params, request }: LoaderArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const locksWeeks = await getLocksWeeksByYear(currentSeason.year);

  return superjson<LoaderData>(
    {
      locksWeeks,
    },
    { headers: { 'x-superjson': 'true' } },
  );
};

export default function GamesLocksMyEntries() {
  const { locksWeeks } = useSuperLoaderData<typeof loader>();

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
