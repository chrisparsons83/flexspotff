import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import D12LeagueBreakdown from '~/components/layout/leaderboard/D12LeagueBreakdown';
import type { LeaderboardEntry } from '~/components/layout/leaderboard/LeaderboardTable';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import GoBox from '~/components/ui/GoBox';
import MemberName from '~/components/ui/MemberName';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { getAllD12SeasonYears } from '~/models/d12season.server';
import {
  computeD12Leaderboard,
  getD12WeekScoresBySeasonYearAndWeek,
  getNewestD12WeekByYear,
} from '~/models/d12weekscore.server';
import { getPlayersBySleepersIds } from '~/models/players.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ params }) => `Week ${params.week}, ${params.year}`,
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  const week = Number(params.week);
  const allYears = await getAllD12SeasonYears();
  if (!allYears.includes(year) || !Number.isInteger(week) || week < 1) {
    throw new Response('Week not found', { status: 404 });
  }

  const weekScores = await getD12WeekScoresBySeasonYearAndWeek(year, week);
  // Reused from the season board - given one week's rows, totalPoints is that
  // week's total and byLeague is that week's split.
  const leaderboard = computeD12Leaderboard(weekScores);
  const maxWeek = await getNewestD12WeekByYear(year);

  // Every starter on the page in one query, so the expanded lineups can show
  // names rather than Sleeper IDs. '0' marks an empty slot and has no player.
  const players = await getPlayersBySleepersIds(
    Array.from(
      new Set(
        weekScores.flatMap(score =>
          score.starters.filter(starter => starter !== '0'),
        ),
      ),
    ),
  );

  return typedjson({ leaderboard, year, week, maxWeek, players });
};

export default function D12Week() {
  const { leaderboard, year, week, maxWeek, players } =
    useTypedLoaderData<typeof loader>();

  const weekOptions = Array.from(
    { length: maxWeek },
    (_, i) => maxWeek - i,
  ).map(weekNumber => ({
    label: `Week ${weekNumber}`,
    url: `/side-leagues/d12/${year}/${weekNumber}`,
  }));

  const entries: LeaderboardEntry[] = leaderboard.map(entry => ({
    id: entry.userId,
    rank: entry.rank,
    name: (
      <Link
        to={`/side-leagues/d12/${year}/user/${entry.userId}`}
        variant='quiet'
      >
        <MemberName user={entry} />
      </Link>
    ),
    values: [entry.totalPoints.toFixed(2)],
    details: (
      <D12LeagueBreakdown
        byLeague={entry.byLeague}
        showLineups
        players={players}
      />
    ),
  }));

  return (
    <Section
      title={`Week ${week}`}
      action={<GoBox options={weekOptions} buttonText='Week' />}
    >
      <LeaderboardTable
        entries={entries}
        valueHeadings={['Points']}
        emptyMessage={`No scores recorded yet for week ${week}.`}
      />
    </Section>
  );
}
