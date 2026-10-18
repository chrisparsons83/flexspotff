import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import type { LeaderboardEntry } from '~/components/layout/leaderboard/LeaderboardTable';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import { Section } from '~/components/ui/section';
import { PositionMark } from '~/components/ui/swatch';
import { Table } from '~/components/ui/table';
import {
  getSleeperDraftPicksForLeague,
  resolveLeagueOwners,
} from '~/libs/d12-sync.server';
import { getOwnerToUserIdMap } from '~/libs/sleeper/owners.server';
import { getD12DraftPicksForLeagues } from '~/models/d12draftpick.server';
import { getD12SeasonByYear } from '~/models/d12season.server';
import type { Player } from '~/models/players.server';
import { getPlayersBySleepersIds } from '~/models/players.server';
import { getUsersByIds } from '~/models/user.server';

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
  if (!yearParam) throw new Response('Season not found', { status: 404 });
  const year = Number(yearParam);
  if (!Number.isInteger(year) || year < 2025) {
    throw new Response('Season not found', { status: 404 });
  }

  const season = await getD12SeasonByYear(year);
  if (!season) throw new Response('Season not found', { status: 404 });

  const leagues = season.leagues;

  // One DB query for all cached picks
  const dbPicks = await getD12DraftPicksForLeagues(leagues.map(l => l.id));
  const cachedLeagueIds = new Set(dbPicks.map(p => p.d12LeagueId));

  // Only call Sleeper for leagues with no cached picks
  const uncachedLeagues = leagues.filter(l => !cachedLeagueIds.has(l.id));
  // Built once rather than per league - it reads the whole member table.
  const owners =
    uncachedLeagues.length > 0 ? await getOwnerToUserIdMap() : new Map();
  const sleeperResults = await Promise.all(
    uncachedLeagues.map(async league => {
      const [picks, { rosterToOwner, ownerToUserId }] = await Promise.all([
        getSleeperDraftPicksForLeague(league.sleeperLeagueId),
        resolveLeagueOwners(league.sleeperLeagueId, owners),
      ]);
      const users = await getUsersByIds(
        Array.from(rosterToOwner.values())
          .map(ownerId => ownerToUserId.get(ownerId))
          .filter((userId): userId is string => Boolean(userId)),
      );
      const userIdToName = new Map(
        users.map(user => [user.id, user.discordName]),
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
      p.user?.discordName ?? '–',
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

  return typedjson({
    adp,
    playersMap,
    year,
    draftedLeagueCount,
    totalLeagues: leagues.length,
  });
};

export default function D12Adp() {
  const { adp, playersMap, year, draftedLeagueCount, totalLeagues } =
    useTypedLoaderData<typeof loader>();

  const entries: LeaderboardEntry[] = adp.map((adpPlayer, index) => {
    const playerInfo = playersMap.get(adpPlayer.sleeperId);
    return {
      id: adpPlayer.sleeperId,
      rank: index + 1,
      name: (
        <span className='inline-flex items-center gap-2'>
          <PositionMark position={playerInfo?.position ?? null} />
          {playerInfo?.fullName ?? adpPlayer.sleeperId}
        </span>
      ),
      values: [
        adpPlayer.avg.toFixed(1),
        adpPlayer.min,
        adpPlayer.max === 181 ? 'Undrafted' : adpPlayer.max,
      ],
      details: (
        <Table headers={['Manager', 'League', 'Pick']} numericColumns={[2]}>
          {adpPlayer.breakdown.map(entry => (
            <tr key={`${entry.leagueName}-${entry.pickNo}`}>
              <td>{entry.discordName}</td>
              <td>{entry.leagueName}</td>
              <td className='text-right'>{entry.pickNo}</td>
            </tr>
          ))}
        </Table>
      ),
    };
  });

  return (
    <Section
      title={`${year} ADP`}
      description={
        draftedLeagueCount < totalLeagues
          ? `${draftedLeagueCount} of ${totalLeagues} leagues have drafted.${
              draftedLeagueCount === 0
                ? ''
                : ' ADP will update as the rest complete their drafts.'
            }`
          : 'Average draft position across every league. A player one league left undrafted counts as pick 181 there.'
      }
    >
      <LeaderboardTable
        entries={entries}
        nameHeading='Player'
        valueHeadings={['ADP', 'Min', 'Max']}
        emptyMessage='ADP fills in once leagues have started drafting.'
      />
    </Section>
  );
}
