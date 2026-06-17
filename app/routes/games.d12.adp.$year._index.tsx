import type { LoaderFunctionArgs } from '@remix-run/node';
import clsx from 'clsx';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import GoBox from '~/components/ui/GoBox';
import { getSleeperDraftPicksForLeague } from '~/libs/d12-sync.server';
import {
  getD12SeasonByYear,
  getAllD12SeasonYears,
} from '~/models/d12season.server';
import type { Player } from '~/models/players.server';
import { getPlayersBySleepersIds } from '~/models/players.server';
import { POSITION_RANK_COLORS } from '~/utils/constants';

type PlayerAdpData = {
  sleeperId: string;
  avg: number;
  min: number;
  max: number;
  count: number;
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const yearParam = params.year;
  if (!yearParam) throw new Error('No year specified');
  const year = Number(yearParam);
  if (!Number.isInteger(year) || year < 2025) throw new Error('Invalid year');

  const season = await getD12SeasonByYear(year);
  if (!season) throw new Error(`No D12 season found for ${year}`);

  const leagues = season.leagues;

  const allPicks = await Promise.all(
    leagues.map(league =>
      getSleeperDraftPicksForLeague(league.sleeperLeagueId),
    ),
  );

  const draftedLeagueCount = allPicks.filter(picks => picks.length > 0).length;

  const playerMap = new Map<
    string,
    { sum: number; count: number; min: number; max: number }
  >();
  for (const picks of allPicks) {
    for (const pick of picks) {
      const existing = playerMap.get(pick.player_id) ?? {
        sum: 0,
        count: 0,
        min: Infinity,
        max: 0,
      };
      existing.sum += pick.pick_no;
      existing.count++;
      existing.min = Math.min(existing.min, pick.pick_no);
      existing.max = Math.max(existing.max, pick.pick_no);
      playerMap.set(pick.player_id, existing);
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
      return { sleeperId, avg, min: data.min, max, count: data.count };
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
              return (
                <tr key={adpPlayer.sleeperId}>
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
                  <td>{playerInfo?.fullName ?? adpPlayer.sleeperId}</td>
                  <td>{playerInfo?.position}</td>
                  <td>{adpPlayer.avg.toFixed(1)}</td>
                  <td>{adpPlayer.min}</td>
                  <td>{adpPlayer.max === 181 ? 'UD' : adpPlayer.max}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
