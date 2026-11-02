import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { DfsLineup } from '~/components/layout/dfs-survivor/DfsSurvivorStandingsRow';
import SeasonLeaders from '~/components/layout/games/SeasonLeaders';
import ThisWeek from '~/components/layout/games/ThisWeek';
import { prisma } from '~/db.server';
import {
  getMemberStanding,
  getSeasonLeaders,
} from '~/libs/games/history.server';
import { dfsSurvivorSeasonTotals } from '~/models/profile/sideGameSeasons.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

/** How many of this season's leaders the overview lists. */
const LEADERS = 10;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [season, user] = await Promise.all([
    getCurrentSeason(),
    authenticator.isAuthenticated(request),
  ]);
  if (!season)
    return typedjson({ year: null, week: null, leaders: [], me: null });

  const [scored, totals] = await Promise.all([
    prisma.dFSSurvivorUserWeek.findFirst({
      where: { year: season.year, isScored: true },
      orderBy: { week: 'desc' },
      select: { week: true },
    }),
    dfsSurvivorSeasonTotals([season.year]),
  ]);

  const leaders = await getSeasonLeaders(totals, season.year, LEADERS);
  // Lineups are for members, as on the week's standings.
  const entries = scored
    ? await prisma.dFSSurvivorUserEntry.findMany({
        where: {
          year: season.year,
          week: scored.week,
          userId: { in: leaders.map(leader => leader.user.id) },
        },
        include: { player: { select: { fullName: true, position: true } } },
      })
    : [];

  const me = user
    ? await getMemberStanding(totals, season.year, user.id)
    : null;

  return typedjson({
    me,
    year: season.year,
    week: scored?.week ?? null,
    signedIn: !!user,
    leaders: leaders.map(leader => {
      const lineup = entries.filter(entry => entry.userId === leader.user.id);
      return {
        ...leader,
        week:
          lineup.length > 0
            ? lineup.reduce((sum, entry) => sum + entry.points, 0).toFixed(2)
            : undefined,
        lineup: user
          ? lineup.map(entry => ({
              ...entry,
              player: {
                ...entry.player,
                position: entry.player.position ?? '',
              },
            }))
          : null,
      };
    }),
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
        entryLabel='Your Lineups'
        standingsHref={week && year ? `standings/${year}/${week}` : undefined}
      />
      {year && (
        <SeasonLeaders
          me={data.me}
          year={year}
          week={week}
          leaders={leaders.map(leader => ({
            ...leader,
            details: leader.lineup && <DfsLineup entries={leader.lineup} />,
          }))}
          standingsPath='standings'
          valueHeading='Points'
        />
      )}
    </>
  );
}
