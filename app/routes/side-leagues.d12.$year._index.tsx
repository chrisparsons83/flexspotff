import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import D12LeagueBreakdown from '~/components/layout/leaderboard/D12LeagueBreakdown';
import type { LeaderboardEntry } from '~/components/layout/leaderboard/LeaderboardTable';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import MemberName from '~/components/ui/MemberName';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { getAllD12SeasonYears } from '~/models/d12season.server';
import {
  computeD12Leaderboard,
  getD12WeekScoresBySeasonYear,
} from '~/models/d12weekscore.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  const allYears = await getAllD12SeasonYears();
  if (!allYears.includes(year)) {
    throw new Response('Season not found', { status: 404 });
  }

  const weekScores = await getD12WeekScoresBySeasonYear(year);
  const leaderboard = computeD12Leaderboard(weekScores);
  return typedjson({ leaderboard, year });
};

export default function D12Season() {
  const { leaderboard, year } = useTypedLoaderData<typeof loader>();

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
    values: [
      entry.totalPoints.toFixed(2),
      entry.bestWeek > 0
        ? `${entry.bestWeekPoints.toFixed(2)}, week ${entry.bestWeek}`
        : '–',
      entry.bestLeagueName
        ? `${entry.bestLeaguePoints.toFixed(2)}, ${entry.bestLeagueName}`
        : '–',
    ],
    details: <D12LeagueBreakdown byLeague={entry.byLeague} />,
  }));

  return (
    <Section title='Standings'>
      <LeaderboardTable
        entries={entries}
        valueHeadings={['Total Points', 'Best Week', 'Best Team']}
        emptyMessage={`No scores recorded yet for ${year}.`}
      />
    </Section>
  );
}
