import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
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

  const poolWeeks = await getPoolWeeksByYear(currentSeason.year);

  return typedjson({
    poolWeeks,
  });
};

export default function GamesQBStreamingMyEntries() {
  const { poolWeeks } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <h2>My Entries</h2>
      <ul>
        {poolWeeks.map(poolWeek => {
          const suffix = poolWeek.isWeekScored
            ? ' - Week Scored'
            : !poolWeek.isOpen
            ? ' - Not Open'
            : '';

          return (
            <li key={poolWeek.id}>
              <Link to={`./${poolWeek.id}`}>
                Week {poolWeek.weekNumber} {suffix}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
