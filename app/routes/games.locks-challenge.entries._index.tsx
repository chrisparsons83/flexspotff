import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import EntryWeeks from '~/components/layout/games/EntryWeeks';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'My entries' };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Response('No season set up yet', { status: 404 });
  }

  const locksWeeks = await getLocksWeeksByYear(currentSeason.year);

  return typedjson({
    locksWeeks,
  });
};

export default function LocksChallengeEntries() {
  const { locksWeeks } = useTypedLoaderData<typeof loader>();

  return (
    <EntryWeeks
      weeks={locksWeeks.map(locksWeek => ({
        id: locksWeek.id,
        week: locksWeek.weekNumber,
        status: locksWeek.isWeekScored
          ? 'Scored'
          : locksWeek.isOpen
          ? 'Open'
          : 'Not open yet',
      }))}
    />
  );
}
