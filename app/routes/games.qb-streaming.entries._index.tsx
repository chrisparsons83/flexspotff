import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import EntryWeeks from '~/components/layout/games/EntryWeeks';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
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

  const qbStreamingWeeks = await getQBStreamingWeeks(currentSeason.year);

  return typedjson({
    qbStreamingWeeks,
  });
};

export default function QBStreamingEntries() {
  const { qbStreamingWeeks } = useTypedLoaderData<typeof loader>();

  return (
    <EntryWeeks
      weeks={qbStreamingWeeks.map(week => ({
        id: week.id,
        week: week.week,
        status: week.isScored
          ? 'Scored'
          : week.isOpen
          ? 'Open'
          : 'Not open yet',
      }))}
    />
  );
}
