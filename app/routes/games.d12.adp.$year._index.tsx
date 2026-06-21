import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/outline';
import type { LoaderFunctionArgs } from '@remix-run/node';
import clsx from 'clsx';
import { Fragment, useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import GoBox from '~/components/ui/GoBox';
import {
  getSleeperDraftPicksForLeague,
  resolveLeagueOwners,
} from '~/libs/d12-sync.server';
import { getD12DraftPicksForLeagues } from '~/models/d12draftpick.server';
import {
  getD12SeasonByYear,
  getAllD12SeasonYears,
} from '~/models/d12season.server';
import type { Player } from '~/models/players.server';
import { getPlayersBySleepersIds } from '~/models/players.server';
import { POSITION_RANK_COLORS } from '~/utils/constants';

type DraftBreakdownEntry = {
  leagueName: string;
  discordName: string;
  pickNo: number;
};

type PlayerAdpData = {
  sleeperId: string;
  avg: number;
  min: number;
  max: number;
  count: number;
  breakdown: DraftBreakdownEntry[];
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const yearParam = params.year;
  if (!yearParam) throw new Error('No year specified');
  const year = Number(yearParam);
  if (!Number.isInteger(year) || year < 2025) throw new Error('Invalid year');

  const season = await getD12SeasonByYear(year);
  if (!season) throw new Error(`No D12 season found for ${year}`);

  const leagues = season.leagues;

  // One DB query for all cached picks
  const dbPicks = await getD12DraftPicksForLeagues(leagues.map(l => l.id));
  const cachedLeagueIds = new Set(dbPicks.map(p => p.d12LeagueId));

  // Only call Sleeper for leagues with no cached picks
  const uncachedLeagues = leagues.filter(l => !cachedLeagueIds.has(l.id));
  const sleeperResults = await Promise.all(
    uncachedLeagues.map(async league => {
      const [picks, { rosterToOwner, ownerToUserId, sleeperUsers }] =
        await Promise.all([
          getSleeperDraftPicksForLeague(league.sleeperLeagueId),
          resolveLeagueOwners(league.sleeperLeagueId),
        ]);
      const userIdToName = new Map(
        sleeperUsers.map(su => [su.userId, su.user.discordName]),
      );
      return { league, picks, rosterToOwner, ownerToUserId, userIdToName };
    }),
  );

  const draftedLeagueCount =
    cachedLeagueIds.size +
    sleeperResults.filter(r => r.picks.length > 0).length;

  const playerMap = new Map<
    string,
    { sum: number; count: number; min: number; max: number }
  >();
  const breakdownMap = new Map<string, DraftBreakdownEntry[]>();

  const accumulate = (
    sleeperId: string,
    pickNo: number,
    leagueName: string,
    discordName: string,
  ) => {
    const existing = playerMap.get(sleeperId) ?? {
      sum: 0,
      count: 0,
      min: Infinity,
      max: 0,
    };
    existing.sum += pickNo;
    existing.count++;
    existing.min = Math.min(existing.min, pickNo);
    existing.max = Math.max(existing.max, pickNo);
    playerMap.set(sleeperId, existing);

    const breakdown = breakdownMap.get(sleeperId) ?? [];
    breakdown.push({ leagueName, discordName, pickNo });
    breakdownMap.set(sleeperId, breakdown);
  };

  for (const p of dbPicks) {
    accumulate(
      p.sleeperId,
      p.pickNo,
      p.league.name,
      p.user?.discordName ?? '—',
    );
  }

  for (const {
    league,
    picks,
    rosterToOwner,
    ownerToUserId,
    userIdToName,
  } of sleeperResults) {
    for (const pick of picks) {
      const ownerId = rosterToOwner.get(pick.roster_id);
      if (!ownerId) continue;
      const userId = ownerToUserId.get(ownerId);
      const discordName = userId
        ? userIdToName.get(userId) ?? ownerId
        : ownerId;
      accumulate(pick.player_id, pick.pick_no, league.name, discordName);
    }
  }

  const adp: PlayerAdpData[] = Array.from(playerMap.entries())
    .map(([sleeperId, data]) => {
      const undrafted =
        draftedLeagueCount > 0 && data.count < draftedLeagueCount;
      const avg = undrafted
        ? (data.sum + 181 * (draftedLeagueCount - data.count)) /
          draftedLeagueCount
        : data.sum / data.count;
      const max = undrafted ? 181 : data.max;
      const breakdown = (breakdownMap.get(sleeperId) ?? []).sort(
        (a, b) => a.pickNo - b.pickNo,
      );
      return {
        sleeperId,
        avg,
        min: data.min,
        max,
        count: data.count,
        breakdown,
      };
    })
    .sort((a, b) => a.avg - b.avg);

  const players = await getPlayersBySleepersIds(adp.map(p => p.sleeperId));
  const playersMap = new Map<string, Player>();
  for (const player of players) {
    if (player.sleeperId) playersMap.set(player.sleeperId, player);
  }

  const allYears = await getAllD12SeasonYears();

  return typedjson({
    adp,
    playersMap,
    year,
    allYears,
    draftedLeagueCount,
    totalLeagues: leagues.length,
  });
};

export default function GamesD12AdpYear() {
  const { adp, playersMap, year, allYears, draftedLeagueCount, totalLeagues } =
    useTypedLoaderData<typeof loader>();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (sleeperId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(sleeperId)) {
        next.delete(sleeperId);
      } else {
        next.add(sleeperId);
      }
      return next;
    });
  };

  return (
    <div>
      <div className='flex items-center justify-between mb-4'>
        <h2>{year} D12 ADP</h2>
        <GoBox
          buttonText='Choose Year'
          options={allYears.map(y => ({
            label: `${y}`,
            url: `/games/d12/adp/${y}`,
          }))}
        />
      </div>

      {draftedLeagueCount < totalLeagues && (
        <p className='text-sm text-gray-400 mb-4'>
          {draftedLeagueCount} of {totalLeagues} leagues have drafted.
          {draftedLeagueCount === 0
            ? ''
            : ' ADP will update as remaining leagues complete their drafts.'}
        </p>
      )}

      {adp.length === 0 ? (
        <div>To be loaded once leagues have started drafting.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Player</th>
              <th>Position</th>
              <th>ADP</th>
              <th>Min</th>
              <th>Max</th>
            </tr>
          </thead>
          <tbody>
            {adp.map((adpPlayer, index) => {
              const playerInfo = playersMap.get(adpPlayer.sleeperId);
              const isExpanded = expandedIds.has(adpPlayer.sleeperId);
              return (
                <Fragment key={adpPlayer.sleeperId}>
                  <tr
                    className={index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}
                  >
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
                    <td className='flex items-center gap-2'>
                      {playerInfo?.fullName ?? adpPlayer.sleeperId}
                      {isExpanded ? (
                        <ChevronUpIcon
                          width={20}
                          height={20}
                          onClick={() => toggle(adpPlayer.sleeperId)}
                          className='cursor-pointer'
                          aria-label='Hide Details'
                        />
                      ) : (
                        <ChevronDownIcon
                          width={20}
                          height={20}
                          onClick={() => toggle(adpPlayer.sleeperId)}
                          className='cursor-pointer'
                          aria-label='Show Details'
                        />
                      )}
                    </td>
                    <td>{playerInfo?.position}</td>
                    <td>{adpPlayer.avg.toFixed(1)}</td>
                    <td>{adpPlayer.min}</td>
                    <td>{adpPlayer.max === 181 ? 'UD' : adpPlayer.max}</td>
                  </tr>
                  {isExpanded && (
                    <tr className='bg-gray-800'>
                      <td></td>
                      <td colSpan={5}>
                        <table>
                          <thead>
                            <tr>
                              <th>Manager</th>
                              <th>League</th>
                              <th>Pick</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adpPlayer.breakdown.map(entry => (
                              <tr key={`${entry.leagueName}-${entry.pickNo}`}>
                                <td>{entry.discordName}</td>
                                <td>{entry.leagueName}</td>
                                <td>{entry.pickNo}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
