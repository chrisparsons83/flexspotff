import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/outline';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import clsx from 'clsx';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { getD12DraftPicksByUserAndLeagues } from '~/models/d12draftpick.server';
import { getD12SeasonByYear } from '~/models/d12season.server';
import type { Player } from '~/models/players.server';
import { getPlayersBySleepersIds } from '~/models/players.server';
import { getUserById } from '~/models/user.server';
import { POSITION_RANK_COLORS } from '~/utils/constants';

type SortCol = 'player' | 'position' | 'leagueCount' | 'avgPick';
type SortDir = 'asc' | 'desc';

const DEFAULT_DIR: Record<SortCol, SortDir> = {
  player: 'asc',
  position: 'asc',
  leagueCount: 'desc',
  avgPick: 'asc',
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { year: yearParam, userId } = params;
  if (!yearParam || !userId) throw new Error('Missing parameters');
  const year = Number(yearParam);
  if (!Number.isInteger(year) || year < 2025) throw new Error('Invalid year');

  const [season, user] = await Promise.all([
    getD12SeasonByYear(year),
    getUserById(userId),
  ]);

  if (!season) throw new Error(`No D12 season found for ${year}`);
  if (!user) throw new Error('User not found');

  const leagueIds = season.leagues.map(l => l.id);
  const allPicks = await getD12DraftPicksByUserAndLeagues(userId, leagueIds);

  const playerMap = new Map<string, { count: number; picks: number[] }>();
  for (const pick of allPicks) {
    const existing = playerMap.get(pick.sleeperId) ?? { count: 0, picks: [] };
    existing.count++;
    existing.picks.push(pick.pickNo);
    playerMap.set(pick.sleeperId, existing);
  }

  const ownership = Array.from(playerMap.entries()).map(
    ([sleeperId, data]) => ({
      sleeperId,
      leagueCount: data.count,
      avgPick: data.picks.reduce((a, b) => a + b, 0) / data.picks.length,
    }),
  );

  const players = await getPlayersBySleepersIds(
    ownership.map(o => o.sleeperId),
  );
  const playersMap = new Map<string, Player>();
  for (const player of players) {
    if (player.sleeperId) playersMap.set(player.sleeperId, player);
  }

  return typedjson({
    ownership,
    playersMap,
    discordName: user.discordName,
    year,
    totalLeagues: season.leagues.length,
  });
};

export default function GamesD12UserRoster() {
  const { ownership, playersMap, discordName, year, totalLeagues } =
    useTypedLoaderData<typeof loader>();

  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({
    col: 'leagueCount',
    dir: 'desc',
  });

  const toggleSort = (col: SortCol) => {
    setSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: DEFAULT_DIR[col] },
    );
  };

  const sorted = [...ownership].sort((a, b) => {
    const aInfo = playersMap.get(a.sleeperId);
    const bInfo = playersMap.get(b.sleeperId);
    let cmp = 0;
    switch (sort.col) {
      case 'player':
        cmp = (aInfo?.fullName ?? '').localeCompare(bInfo?.fullName ?? '');
        break;
      case 'position':
        cmp = (aInfo?.position ?? '').localeCompare(bInfo?.position ?? '');
        break;
      case 'leagueCount':
        cmp = a.leagueCount - b.leagueCount;
        break;
      case 'avgPick':
        cmp = a.avgPick - b.avgPick;
        break;
    }
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const sortIndicator = (col: SortCol) =>
    sort.col === col ? (
      sort.dir === 'asc' ? (
        <ChevronUpIcon width={14} height={14} className='inline ml-1' />
      ) : (
        <ChevronDownIcon width={14} height={14} className='inline ml-1' />
      )
    ) : null;

  return (
    <div>
      <div className='mb-4'>
        <Link
          to={`/games/d12/${year}`}
          className='text-sm text-gray-400 hover:text-white'
        >
          ← {year} Leaderboard
        </Link>
      </div>
      <h2>
        {discordName} — {year} Roster
      </h2>
      <p className='text-gray-400 mb-4 text-sm'>{totalLeagues} leagues total</p>

      {ownership.length === 0 ? (
        <p>No picks found for this user.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th></th>
              <th
                className='cursor-pointer select-none'
                onClick={() => toggleSort('player')}
              >
                Player{sortIndicator('player')}
              </th>
              <th
                className='cursor-pointer select-none'
                onClick={() => toggleSort('position')}
              >
                Position{sortIndicator('position')}
              </th>
              <th
                className='cursor-pointer select-none'
                onClick={() => toggleSort('leagueCount')}
              >
                Leagues Owned{sortIndicator('leagueCount')}
              </th>
              <th
                className='cursor-pointer select-none'
                onClick={() => toggleSort('avgPick')}
              >
                Avg Pick{sortIndicator('avgPick')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, index) => {
              const playerInfo = playersMap.get(item.sleeperId);
              return (
                <tr key={item.sleeperId}>
                  <td className='pl-1'>
                    <div
                      className={clsx(
                        POSITION_RANK_COLORS[
                          playerInfo?.position?.toLowerCase() ?? ''
                        ],
                        'mx-auto w-8 h-8 flex justify-center items-center font-bold text-sm',
                      )}
                    >
                      {index + 1}
                    </div>
                  </td>
                  <td>{playerInfo?.fullName ?? item.sleeperId}</td>
                  <td>{playerInfo?.position}</td>
                  <td>
                    {item.leagueCount} / {totalLeagues}
                  </td>
                  <td>{item.avgPick.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
