import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import SeasonLeaders from '~/components/layout/games/SeasonLeaders';
import ThisWeek from '~/components/layout/games/ThisWeek';
import { getSeasonLeaders } from '~/libs/games/history.server';
import { qbStreamingSeasonTotals } from '~/models/profile/sideGameSeasons.server';
import { getQBStreamingWeeks } from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  if (!season) return typedjson({ year: null, week: null, leaders: [] });

  const [weeks, totals] = await Promise.all([
    getQBStreamingWeeks(season.year),
    qbStreamingSeasonTotals([season.year]),
  ]);
  // Newest first.
  const week = weeks[0] ?? null;

  return typedjson({
    year: season.year,
    week: week && {
      id: week.id,
      number: week.week,
      status: week.isScored
        ? 'Scored.'
        : week.isOpen
        ? 'The options are set: picks are open.'
        : 'The options are not set yet.',
      canEnter: !!user && week.isOpen && !week.isScored,
    },
    leaders: await getSeasonLeaders(totals, season.year),
  });
};

export default function QBStreamingOverview() {
  const { year, week, leaders } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <ThisWeek
        week={week?.number ?? null}
        status={week?.status ?? ''}
        entryHref={week?.canEnter ? `entries/${week.id}` : undefined}
        standingsHref={
          week && year ? `standings/${year}/${week.number}` : undefined
        }
      />
      {year && (
        <SeasonLeaders
          year={year}
          leaders={leaders}
          standingsPath='standings'
          valueHeading='Points'
        />
      )}
    </>
  );
}
