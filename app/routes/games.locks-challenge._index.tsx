import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import SeasonLeaders from '~/components/layout/games/SeasonLeaders';
import ThisWeek from '~/components/layout/games/ThisWeek';
import { getSeasonLeaders } from '~/libs/games/history.server';
import { getLocksWeeksByYear } from '~/models/locksweek.server';
import { locksSeasonTotals } from '~/models/profile/sideGameSeasons.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  if (!season) return typedjson({ year: null, week: null, leaders: [] });

  const [weeks, totals] = await Promise.all([
    getLocksWeeksByYear(season.year),
    locksSeasonTotals([season.year]),
  ]);
  // Newest first; the open week if there is one.
  const week = weeks.find(locksWeek => locksWeek.isOpen) ?? weeks[0] ?? null;

  return typedjson({
    year: season.year,
    week: week && {
      id: week.id,
      number: week.weekNumber,
      status: week.isWeekScored
        ? 'Scored.'
        : week.isOpen
        ? 'Open for picks until 1:00 pm Eastern on Sunday, or each game’s kickoff if sooner.'
        : 'Not open yet.',
      canEnter: !!user && week.isOpen && !week.isWeekScored,
    },
    leaders: await getSeasonLeaders(totals, season.year),
  });
};

export default function LocksChallengeOverview() {
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
          formatValue={points => `${points}`}
        />
      )}
    </>
  );
}
