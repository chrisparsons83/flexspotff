import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import EntryWeeks from '~/components/layout/games/EntryWeeks';
import { getPoolWeeksByYear } from '~/models/poolweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Response('No season set up yet', { status: 404 });
  }

  const poolWeeks = await getPoolWeeksByYear(currentSeason.year);

  return typedjson({
    poolWeeks,
  });
};

export default function SpreadPoolEntries() {
  const { poolWeeks } = useTypedLoaderData<typeof loader>();

  return (
    <EntryWeeks
      weeks={poolWeeks.map(poolWeek => ({
        id: poolWeek.id,
        week: poolWeek.weekNumber,
        status: poolWeek.isWeekScored
          ? 'Scored'
          : poolWeek.isOpen
          ? 'Open'
          : 'Not open yet',
      }))}
    />
  );
}
