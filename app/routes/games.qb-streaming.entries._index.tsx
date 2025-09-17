import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  const qbStreamingWeeks = await getQBStreamingWeeks(currentSeason.year);

  return typedjson({
    qbStreamingWeeks,
  });
};

export default function GamesQBStreamingMyEntries() {
  const { qbStreamingWeeks } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <h2>My Entries</h2>
      <ul>
        {qbStreamingWeeks.map(qbStreamingWeek => {
          const suffix = qbStreamingWeek.isScored
            ? '- Week Scored'
            : !qbStreamingWeek.isOpen
            ? '- Not Open'
            : '';

          return (
            <li key={qbStreamingWeek.id}>
              <Link to={`./${qbStreamingWeek.id}`}>
                Week {qbStreamingWeek.week} {suffix}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
