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
  getD12WeekScoresBySeasonYear,
  getNewestD12WeekByYear,
} from '~/models/d12weekscore.server';
import { LEADERBOARD_NAME_LINK, rankBadgeColor } from '~/utils/constants';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const yearParam = params.year;
  if (!yearParam) throw new Error('No year specified');
  const year = Number(yearParam);
  if (!Number.isInteger(year)) throw new Error('Invalid year');

  const allYears = await getAllD12SeasonYears();
  if (allYears.length > 0 && year < Math.min(...allYears)) {
    throw new Error('Invalid year');
  }

  const weekScores = await getD12WeekScoresBySeasonYear(year);
  const leaderboard = computeD12Leaderboard(weekScores);
  const newestWeek = await getNewestD12WeekByYear(year);

  return typedjson({ leaderboard, year, allYears, newestWeek });
};

export default function GamesD12YearIndex() {
  const { leaderboard, year, allYears, newestWeek } =
    useTypedLoaderData<typeof loader>();

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
    values: [
      entry.totalPoints.toFixed(2),
      entry.bestWeek > 0
        ? `${entry.bestWeekPoints.toFixed(2)} (Wk ${entry.bestWeek})`
        : '—',
      entry.bestLeagueName
        ? `${entry.bestLeaguePoints.toFixed(2)} (${entry.bestLeagueName})`
        : '—',
    ],
    details: <D12LeagueBreakdown byLeague={entry.byLeague} />,
  }));

  return (
    <div>
      <div className='flex items-center justify-between mb-4'>
        <h2>{year} Leaderboard</h2>
        <div className='flex items-center gap-2'>
          <Link to={`/games/d12/${year}/${newestWeek}`} className='text-sm'>
            Weekly leaderboard
          </Link>
          <GoBox
            buttonText='Choose Year'
            options={allYears.map(y => ({
              label: `${y}`,
              url: `/games/d12/${y}`,
            }))}
          />
        </div>
      </div>

      <LeaderboardTable
        entries={entries}
        valueHeadings={['Total Points', 'Best Week', 'Best Team']}
        emptyMessage={`No scores recorded yet for ${year}.`}
      />
    </div>
  );
}
