import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import LiveChopLinePanel from '~/components/layout/guillotine/LiveChopLinePanel';
import GoBox from '~/components/ui/GoBox';
import { EmptyState } from '~/components/ui/empty-state';
import { PlayerLabel } from '~/components/ui/player-label';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
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
import { cn } from '~/utils';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ params }) => `Week ${params.week}`,
};

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
    url: `/side-leagues/guillotine/${leagueId}/week/${w}`,
  }));

  return (
    <Section
      title={`Week ${week}`}
      action={<GoBox options={weekOptions} buttonText='Week' />}
    >
      {live ? (
        <LiveChopLinePanel
          week={week}
          live={live}
          names={names}
          leagueId={leagueId}
          showWeekLink={false}
        />
      ) : isLive ? (
        <EmptyState title={`Week ${week} has not started yet`} />
      ) : ranked.length === 0 ? (
        <EmptyState title={`No scores for week ${week}`} />
      ) : (
        <Section as='h3' title='Scores'>
          <div className='overflow-x-auto'>
            <table className='w-full text-left tabular-nums'>
              <thead>
                <tr className='border-b border-border text-sm text-muted-foreground'>
                  <th className='px-3 py-2.5 text-right font-semibold'>Rank</th>
                  <th className='px-3 py-2.5 font-semibold'>Team</th>
                  <th className='px-3 py-2.5 text-right font-semibold'>
                    Points
                  </th>
                  <th className='px-3 py-2.5 text-right font-semibold'>
                    Above the chop
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, index) => (
                  <tr
                    key={row.rosterId}
                    className={cn(
                      'border-b border-border',
                      row.chopped && 'bg-destructive/20',
                      index === ranked.length - 2 &&
                        'border-b-[3px] border-b-destructive',
                    )}
                  >
                    <td className='px-3 py-2.5 text-right text-muted-foreground'>
                      {row.rank}
                    </td>
                    <td className='px-3 py-2.5'>
                      {row.name}
                      {row.chopped && (
                        <div className='font-semibold text-negative'>
                          Chopped
                        </div>
                      )}
                    </td>
                    <td className='px-3 py-2.5 text-right'>
                      {pts(row.points)}
                    </td>
                    <td className='px-3 py-2.5 text-right'>
                      {row.chopped || row.margin === null
                        ? '–'
                        : `+${pts(row.margin)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {chopped && (
        <Section
          as='h3'
          title={`${chopped.name} released`}
          description={`Chopped with ${pts(
            chopped.points,
          )} points. Where the roster went in the next waiver run.`}
        >
          <Table
            headers={['Player', 'Claimed by', 'Winning bid', 'Bids']}
            numericColumns={[2, 3]}
            primaryColumns={[1]}
          >
            {chopped.released.map(player => (
              <tr key={player.sleeperId}>
                <td>
                  <PlayerLabel player={player} />
                </td>
                <td>
                  {player.claimedBy?.name ?? (
                    <span className='text-muted-foreground'>Nobody</span>
                  )}
                </td>
                <td className='text-right'>
                  {player.claimedBy ? `$${player.claimedBy.bid}` : '–'}
                </td>
                <td className='text-right'>{player.bids || '–'}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {nextRun && nextRun.claims.length > 0 && (
        <Section as='h3' title={`Waivers for week ${nextRun.week}`}>
          <Table
            headers={['Player', 'Won by', 'Bid', 'Next best', 'Bids']}
            numericColumns={[2, 3, 4]}
            primaryColumns={[1, 2]}
          >
            {nextRun.claims.map(claim => (
              <tr key={claim.sleeperId}>
                <td>
                  <PlayerLabel player={claim} />
                  {claim.fromChop && (
                    <div className='text-sm text-muted-foreground'>
                      from {claim.fromChop}
                    </div>
                  )}
                </td>
                <td>{claim.winner.name}</td>
                <td className='text-right'>${claim.winner.bid}</td>
                <td className='text-right'>
                  {claim.runnerUpBid === null ? '–' : `$${claim.runnerUpBid}`}
                </td>
                <td className='text-right'>{claim.bids}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
    </Section>
  );
}
