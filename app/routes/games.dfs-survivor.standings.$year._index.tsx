import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import StandingsSection from '~/components/layout/games/StandingsSection';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import { ScoreGrid } from '~/components/layout/side-leagues/ScoreGrid';
import MemberName from '~/components/ui/MemberName';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
import { prisma } from '~/db.server';
import { sideGameYears } from '~/models/profile/sideGameSeasons.server';
import { getUsersByIds } from '~/models/user.server';
import { authenticator } from '~/services/auth.server';
import { assignCompetitionRanks } from '~/utils/rank';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ params }) => `${params.year} standings`,
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const year = Number(params.year);

  // Each member's points in each scored week they set a lineup for, which
  // is how the season totals everywhere else count them.
  const scoredWeeks = await prisma.dFSSurvivorUserWeek.findMany({
    where: { year, isScored: true },
    select: { userId: true, week: true, entries: { select: { points: true } } },
  });
  const byUser = new Map<string, Record<number, number>>();
  for (const userWeek of scoredWeeks) {
    if (userWeek.entries.length === 0) continue;
    const weeks = byUser.get(userWeek.userId) ?? {};
    weeks[userWeek.week] = userWeek.entries.reduce(
      (sum, entry) => sum + entry.points,
      0,
    );
    byUser.set(userWeek.userId, weeks);
  }

  const ranked = assignCompetitionRanks(
    [...byUser.entries()]
      .map(([userId, weeks]) => ({
        userId,
        weeks,
        points: Object.values(weeks).reduce((sum, points) => sum + points, 0),
      }))
      .sort((a, b) => b.points - a.points),
    row => row.points,
  );
  const users = await getUsersByIds(ranked.map(row => row.userId));

  // The week's best score, for the grid to mark.
  const highs: Record<number, number> = {};
  for (const row of ranked) {
    for (const [week, points] of Object.entries(row.weeks)) {
      highs[Number(week)] = Math.max(highs[Number(week)] ?? 0, points);
    }
  }
  const weeks = [...new Set(scoredWeeks.map(row => row.week))].sort(
    (a, b) => b - a,
  );

  return typedjson({
    rows: ranked.map(row => {
      const user = users.find(candidate => candidate.id === row.userId);
      return {
        ...row,
        user: {
          id: row.userId,
          discordName: user?.discordName ?? 'Former member',
          discordUsername: user?.discordUsername ?? null,
        },
      };
    }),
    highs,
    year,
    weeks,
    years: await sideGameYears('dfsSurvivor'),
  });
};

export default function DfsSurvivorStandings() {
  const { rows, highs, year, weeks, years } =
    useTypedLoaderData<typeof loader>();
  const name = (row: (typeof rows)[number]) => (
    <ProfileLink userId={row.user.id}>
      <MemberName user={row.user} />
    </ProfileLink>
  );

  return (
    <>
      <StandingsSection
        base='/games/dfs-survivor/standings'
        year={year}
        years={years}
        weeks={weeks}
      >
        <LeaderboardTable
          entries={rows.map(row => ({
            id: row.userId,
            rank: row.rank,
            name: name(row),
            values: [row.points.toFixed(2)],
          }))}
          nameHeading='Member'
          valueHeadings={['Points']}
          emptyMessage='No weeks scored yet this season.'
        />
      </StandingsSection>
      {weeks.length > 0 && (
        <Section
          title='Week by week'
          description={
            <span className='inline-flex items-center gap-2 text-sm'>
              <span aria-hidden className='size-3 bg-positive/30' />
              Top score of the week
            </span>
          }
        >
          <ScoreGrid
            rows={rows.map(row => ({
              ...row,
              key: row.userId,
              name: name(row),
            }))}
            weeks={Math.max(...weeks)}
            nameHeading='Member'
            weekHref={week => `/games/dfs-survivor/standings/${year}/${week}`}
            cell={(row, week) => {
              const points = row.weeks[week];
              if (points === undefined) return null;
              return {
                value: points.toFixed(1),
                title: `Week ${week}: ${points.toFixed(2)} pts`,
                tone:
                  points > 0 && points === highs[week]
                    ? 'bg-positive/30 font-semibold'
                    : 'bg-muted',
              };
            }}
          />
        </Section>
      )}
    </>
  );
}
