import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import D12LeagueBreakdown from '~/components/layout/leaderboard/D12LeagueBreakdown';
import type { LeaderboardEntry } from '~/components/layout/leaderboard/LeaderboardTable';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import GoBox from '~/components/ui/GoBox';
import { getAllD12SeasonYears } from '~/models/d12season.server';
import {
  computeD12Leaderboard,
  getD12WeekScoresBySeasonYearAndWeek,
  getNewestD12WeekByYear,
} from '~/models/d12weekscore.server';
import { LEADERBOARD_NAME_LINK, rankBadgeColor } from '~/utils/constants';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const year = Number(params.year);
  const week = Number(params.week);
  if (!Number.isInteger(year)) throw new Error('Invalid year');
  if (!Number.isInteger(week) || week < 1) throw new Error('Invalid week');

  const allYears = await getAllD12SeasonYears();
  if (allYears.length > 0 && year < Math.min(...allYears)) {
    throw new Error('Invalid year');
  }

  const weekScores = await getD12WeekScoresBySeasonYearAndWeek(year, week);
  // Reused from the season board - given one week's rows, totalPoints is that
  // week's total and byLeague is that week's split.
  const leaderboard = computeD12Leaderboard(weekScores);
  const maxWeek = await getNewestD12WeekByYear(year);

  return typedjson({ leaderboard, year, week, maxWeek });
};

export default function GamesD12YearWeek() {
  const { leaderboard, year, week, maxWeek } =
    useTypedLoaderData<typeof loader>();

  const weekArray = Array.from({ length: maxWeek }, (_, i) => i + 1)
    .reverse()
    .map(weekNumber => ({
      label: `Week ${weekNumber}`,
      url: `/games/d12/${year}/${weekNumber}`,
    }));

  const entries: LeaderboardEntry[] = leaderboard.map(entry => ({
    id: entry.userId,
    rank: entry.rank,
    badgeClassName: rankBadgeColor(entry.rank),
    name: (
      <Link
        to={`/games/d12/${year}/user/${entry.userId}`}
        className={LEADERBOARD_NAME_LINK}
      >
        {entry.discordName}
      </Link>
    ),
    values: [entry.totalPoints.toFixed(2)],
    details: <D12LeagueBreakdown byLeague={entry.byLeague} />,
  }));

  return (
    <div>
      <div className='flex items-center justify-between mb-4'>
        <h2>
          {year} Week {week} Leaderboard
        </h2>
        <div className='flex items-center gap-2'>
          <Link to={`/games/d12/${year}`} className='text-sm'>
            Season leaderboard
          </Link>
          <GoBox options={weekArray} buttonText='Choose Week' />
        </div>
      </div>

      <LeaderboardTable
        entries={entries}
        valueHeadings={['Points']}
        emptyMessage={`No scores recorded yet for week ${week}.`}
      />
    </div>
  );
}
