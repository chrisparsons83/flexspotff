import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/outline';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import YearSelector from '~/components/ui/YearSelector';
import { getAllD12SeasonYears } from '~/models/d12season.server';
import {
  computeD12Leaderboard,
  getD12WeekScoresBySeasonYear,
  type D12LeaderboardEntry,
} from '~/models/d12weekscore.server';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const yearParam = params.year;
  if (!yearParam) throw new Error('No year specified');
  const year = Number(yearParam);
  if (!Number.isInteger(year) || year < 2025) throw new Error('Invalid year');

  const weekScores = await getD12WeekScoresBySeasonYear(year);
  const leaderboard = computeD12Leaderboard(weekScores);
  const allYears = await getAllD12SeasonYears();

  return typedjson({ leaderboard, year, allYears });
};

function BreakdownRow({ entry }: { entry: D12LeaderboardEntry }) {
  return (
    <tr className='border-b bg-gray-800'>
      <td></td>
      <td colSpan={3}>
        <table>
          <thead>
            <tr>
              <th>League</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {entry.byLeague
              .slice()
              .sort((a, b) => b.points - a.points)
              .map(l => (
                <tr key={l.leagueId}>
                  <td>{l.leagueName}</td>
                  <td>{l.points.toFixed(2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

export default function GamesD12YearIndex() {
  const { leaderboard, year, allYears } = useTypedLoaderData<typeof loader>();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (userId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  return (
    <div>
      <div className='flex items-center justify-between mb-4'>
        <h2>{year} Leaderboard</h2>
        <YearSelector
          year={year}
          years={allYears}
          buildUrl={y => `/games/d12/${y}`}
        />
      </div>

      {leaderboard.length === 0 ? (
        <p>No scores recorded yet for {year}.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Manager</th>
              <th>Total Points</th>
              <th>Best Week</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map(entry => [
              <tr key={entry.userId}>
                <td>{entry.rank}</td>
                <td className='flex items-center gap-3'>
                  <Link
                    to={`/games/d12/${year}/user/${entry.userId}`}
                    className='hover:underline'
                  >
                    {entry.discordName}
                  </Link>
                  {expandedIds.has(entry.userId) ? (
                    <ChevronUpIcon
                      width={20}
                      height={20}
                      onClick={() => toggle(entry.userId)}
                      className='cursor-pointer'
                      aria-label='Hide Details'
                    />
                  ) : (
                    <ChevronDownIcon
                      width={20}
                      height={20}
                      onClick={() => toggle(entry.userId)}
                      className='cursor-pointer'
                      aria-label='Show Details'
                    />
                  )}
                </td>
                <td>{entry.totalPoints.toFixed(2)}</td>
                <td>
                  {entry.bestWeek > 0
                    ? `${entry.bestWeekPoints.toFixed(2)} (Wk ${
                        entry.bestWeek
                      })`
                    : '—'}
                </td>
              </tr>,
              expandedIds.has(entry.userId) && (
                <BreakdownRow key={`${entry.userId}-breakdown`} entry={entry} />
              ),
            ])}
          </tbody>
        </table>
      )}
    </div>
  );
}
