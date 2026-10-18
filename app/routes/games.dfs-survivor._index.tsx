import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import SeasonLeaders from '~/components/layout/games/SeasonLeaders';
import ThisWeek from '~/components/layout/games/ThisWeek';
import { prisma } from '~/db.server';
import { getSeasonLeaders } from '~/libs/games/history.server';
import { dfsSurvivorSeasonTotals } from '~/models/profile/sideGameSeasons.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  if (!season) return typedjson({ year: null, week: null, leaders: [] });

  const [scored, totals] = await Promise.all([
    prisma.dFSSurvivorUserWeek.findFirst({
      where: { year: season.year, isScored: true },
      orderBy: { week: 'desc' },
      select: { week: true },
    }),
    dfsSurvivorSeasonTotals([season.year]),
  ]);

  return typedjson({
    year: season.year,
    week: scored?.week ?? null,
    signedIn: !!user,
    leaders: await getSeasonLeaders(totals, season.year),
  });
};

export default function DfsSurvivorOverview() {
  const data = useTypedLoaderData<typeof loader>();
  const { year, week, leaders } = data;
  const signedIn = 'signedIn' in data && data.signedIn;

  return (
    <>
      <ThisWeek
        week={week}
        status={week ? `Scored through week ${week}.` : ''}
        entryHref={signedIn ? 'entries' : undefined}
        standingsHref={week && year ? `standings/${year}/${week}` : undefined}
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
