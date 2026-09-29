import type { LoaderFunctionArgs } from '@remix-run/node';
import clsx from 'clsx';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import LiveChopLinePanel from '~/components/layout/guillotine/LiveChopLinePanel';
import PlayerLabel from '~/components/layout/guillotine/PlayerLabel';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import GoBox from '~/components/ui/GoBox';
import { requireGuillotineAccess } from '~/libs/guillotine/access.server';
import { GUILLOTINE_FINAL_WEEK } from '~/libs/guillotine/chops';
import { pts, teamName } from '~/libs/guillotine/display';
import { buildLiveChopLine } from '~/libs/guillotine/live.server';
import type { ViewTransaction } from '~/libs/guillotine/views';
import { buildWaiverRuns, cutLineForWeek } from '~/libs/guillotine/views';
import {
  getGuillotineLeagueForPage,
  getGuillotineTransactions,
} from '~/models/guillotine.server';
import { getPlayersBySleepersIds } from '~/models/players.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireGuillotineAccess(request);

  const week = Number(params.week);
  if (!Number.isInteger(week) || week < 1 || week > GUILLOTINE_FINAL_WEEK) {
    throw new Response('No such week', { status: 404 });
  }

  const [league, transactions] = await Promise.all([
    getGuillotineLeagueForPage(params.leagueId ?? ''),
    getGuillotineTransactions(params.leagueId ?? ''),
  ]);
  if (!league) throw new Response('League not found', { status: 404 });

  const scores = league.teams.flatMap(team =>
    team.weekScores.map(score => ({
      rosterId: team.rosterId,
      week: score.week,
      points: score.points,
      players: score.players,
    })),
  );
  const names = new Map(league.teams.map(t => [t.rosterId, teamName(t)]));
  const isLive = !league.isComplete && week > league.lastScoredWeek;
  const lastWeek = Math.min(
    league.isComplete ? GUILLOTINE_FINAL_WEEK : league.lastScoredWeek + 1,
    GUILLOTINE_FINAL_WEEK,
  );

  const live =
    isLive && scores.some(s => s.week === week)
      ? await buildLiveChopLine({
          year: league.season.year,
          week,
          teams: league.teams,
        })
      : null;

  const cut = cutLineForWeek(scores, week);
  const ranked = scores
    .filter(s => s.week === week)
    .sort((a, b) => b.points - a.points)
    .map((s, index) => ({
      rosterId: s.rosterId,
      name: names.get(s.rosterId) ?? '',
      rank: index + 1,
      points: s.points,
      margin: cut === null ? null : s.points - cut,
      chopped:
        league.teams.find(t => t.rosterId === s.rosterId)?.choppedWeek === week,
    }));

  const choppedTeam = league.teams.find(t => t.choppedWeek === week);
  const released =
    choppedTeam?.weekScores.find(s => s.week === week)?.players ?? [];

  // The run straight after this week's chop, which is where the released
  // players went. Its claims are for next week.
  const runs = buildWaiverRuns({
    transactions: transactions as ViewTransaction[],
    teams: league.teams,
    scores,
  });
  const nextRun = runs.find(run => run.week === week + 1) ?? null;
  const claimByPlayer = new Map(
    (nextRun?.claims ?? []).map(claim => [claim.sleeperId, claim]),
  );

  const players = await getPlayersBySleepersIds(
    Array.from(
      new Set([...released, ...(nextRun?.claims.map(c => c.sleeperId) ?? [])]),
    ),
  );
  const playerById = new Map(players.map(p => [p.sleeperId, p]));
  const describe = (sleeperId: string) => {
    const player = playerById.get(sleeperId);
    return {
      sleeperId,
      name: player?.fullName ?? sleeperId,
      position: player?.position ?? null,
      nflTeam: player?.nflTeam ?? null,
    };
  };

  return typedjson({
    leagueId: league.id,
    week,
    lastWeek,
    isLive,
    live,
    ranked,
    names: Object.fromEntries(names) as Record<number, string>,
    chopped: choppedTeam
      ? {
          name: names.get(choppedTeam.rosterId) ?? '',
          points: choppedTeam.weekScores.find(s => s.week === week)?.points,
          released: released
            .map(sleeperId => {
              const claim = claimByPlayer.get(sleeperId);
              return {
                ...describe(sleeperId),
                claimedBy: claim?.winner
                  ? {
                      name: names.get(claim.winner.rosterId) ?? '',
                      bid: claim.winner.bid,
                    }
                  : null,
                bids: claim
                  ? claim.losingBids.length + (claim.winner ? 1 : 0)
                  : 0,
              };
            })
            .sort(
              (a, b) =>
                (b.claimedBy?.bid ?? -1) - (a.claimedBy?.bid ?? -1) ||
                a.name.localeCompare(b.name),
            ),
        }
      : null,
    nextRun: nextRun
      ? {
          week: nextRun.week,
          claims: nextRun.claims
            .filter(claim => claim.winner)
            .map(claim => ({
              ...describe(claim.sleeperId),
              winner: {
                name: names.get(claim.winner!.rosterId) ?? '',
                bid: claim.winner!.bid,
              },
              runnerUpBid: claim.losingBids[0]?.bid ?? null,
              bids: claim.losingBids.length + 1,
              fromChop: claim.releasedBy
                ? names.get(claim.releasedBy.rosterId) ?? null
                : null,
            })),
        }
      : null,
  });
};

export default function GuillotineWeek() {
  const {
    leagueId,
    week,
    lastWeek,
    isLive,
    live,
    ranked,
    names,
    chopped,
    nextRun,
  } = useTypedLoaderData<typeof loader>();

  const weekOptions = Array.from(
    { length: lastWeek },
    (_, i) => lastWeek - i,
  ).map(w => ({
    label: `Week ${w}`,
    url: `/games/guillotine/${leagueId}/week/${w}`,
  }));

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h3 className='m-0'>Week {week}</h3>
        <GoBox options={weekOptions} buttonText='Choose Week' />
      </div>

      {live ? (
        <LiveChopLinePanel
          week={week}
          live={live}
          names={names}
          leagueId={leagueId}
          showWeekLink={false}
        />
      ) : isLive ? (
        <p>Week {week} has not started yet.</p>
      ) : ranked.length === 0 ? (
        <p>No scores for week {week}.</p>
      ) : (
        <ProfileSection
          title='Scores'
          description='Every surviving team, highest first. The line is the chop.'
        >
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-slate-400'>
                <th className='py-1 pr-2'>#</th>
                <th className='py-1 pr-2'>Team</th>
                <th className='py-1 pr-2 text-right'>Points</th>
                <th className='py-1 text-right'>Above the Chop</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, index) => (
                <tr
                  key={row.rosterId}
                  className={clsx(
                    'border-t border-slate-700',
                    row.chopped && 'bg-rose-900/40',
                    index === ranked.length - 2 &&
                      'border-b-2 border-b-rose-500',
                  )}
                >
                  <td className='py-1.5 pr-2 text-slate-400'>{row.rank}</td>
                  <td className='py-1.5 pr-2 text-white'>
                    {row.name}
                    {row.chopped && (
                      <span className='ml-2 rounded bg-rose-600 px-1.5 py-0.5 text-xs font-bold uppercase'>
                        Chopped
                      </span>
                    )}
                  </td>
                  <td className='py-1.5 pr-2 text-right tabular-nums'>
                    {pts(row.points)}
                  </td>
                  <td className='py-1.5 text-right tabular-nums'>
                    {row.chopped || row.margin === null
                      ? '—'
                      : `+${pts(row.margin)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ProfileSection>
      )}

      {chopped && (
        <ProfileSection
          title={`${chopped.name} Released`}
          description={`Chopped with ${pts(
            chopped.points,
          )} points. Where the roster went in the next waiver run.`}
        >
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-slate-400'>
                <th className='py-1 pr-2'>Player</th>
                <th className='py-1 pr-2'>Claimed By</th>
                <th className='py-1 pr-2 text-right'>Winning Bid</th>
                <th className='py-1 text-right'>Bids</th>
              </tr>
            </thead>
            <tbody>
              {chopped.released.map(player => (
                <tr
                  key={player.sleeperId}
                  className='border-t border-slate-700'
                >
                  <td className='py-1.5 pr-2 text-white'>
                    <PlayerLabel player={player} />
                  </td>
                  <td className='py-1.5 pr-2'>
                    {player.claimedBy?.name ?? (
                      <span className='text-slate-500'>Nobody</span>
                    )}
                  </td>
                  <td className='py-1.5 pr-2 text-right tabular-nums'>
                    {player.claimedBy ? `$${player.claimedBy.bid}` : '—'}
                  </td>
                  <td className='py-1.5 text-right tabular-nums'>
                    {player.bids || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ProfileSection>
      )}

      {nextRun && nextRun.claims.length > 0 && (
        <ProfileSection
          title={`Waivers for Week ${nextRun.week}`}
          description='Every claim that went through in the run after this week, biggest bids first.'
        >
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-slate-400'>
                <th className='py-1 pr-2'>Player</th>
                <th className='py-1 pr-2'>Won By</th>
                <th className='py-1 pr-2 text-right'>Bid</th>
                <th className='py-1 pr-2 text-right'>Next Best</th>
                <th className='py-1 text-right'>Bids</th>
              </tr>
            </thead>
            <tbody>
              {nextRun.claims.map(claim => (
                <tr key={claim.sleeperId} className='border-t border-slate-700'>
                  <td className='py-1.5 pr-2 text-white'>
                    <PlayerLabel player={claim} />
                    {claim.fromChop && (
                      <div className='text-xs text-slate-400'>
                        from {claim.fromChop}
                      </div>
                    )}
                  </td>
                  <td className='py-1.5 pr-2'>{claim.winner.name}</td>
                  <td className='py-1.5 pr-2 text-right tabular-nums'>
                    ${claim.winner.bid}
                  </td>
                  <td className='py-1.5 pr-2 text-right tabular-nums'>
                    {claim.runnerUpBid === null ? '—' : `$${claim.runnerUpBid}`}
                  </td>
                  <td className='py-1.5 text-right tabular-nums'>
                    {claim.bids}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ProfileSection>
      )}
    </div>
  );
}
