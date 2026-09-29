import type { LoaderFunctionArgs } from '@remix-run/node';
import { Form, useSubmit } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import PlayerLabel from '~/components/layout/guillotine/PlayerLabel';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import StatTile from '~/components/layout/profile/StatTile';
import { requireGuillotineAccess } from '~/libs/guillotine/access.server';
import { teamName } from '~/libs/guillotine/display';
import type { ViewTransaction } from '~/libs/guillotine/views';
import { buildWaiverRuns } from '~/libs/guillotine/views';
import {
  getGuillotineLeagueForPage,
  getGuillotineTransactions,
} from '~/models/guillotine.server';
import { getPlayersBySleepersIds } from '~/models/players.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireGuillotineAccess(request);

  const [league, transactions] = await Promise.all([
    getGuillotineLeagueForPage(params.leagueId ?? ''),
    getGuillotineTransactions(params.leagueId ?? ''),
  ]);
  if (!league) throw new Response('League not found', { status: 404 });

  const url = new URL(request.url);
  // The latest run by default: a whole season is a couple of hundred claims.
  const weekParam = url.searchParams.get('week');
  const teamFilter = Number(url.searchParams.get('team')) || null;

  const scores = league.teams.flatMap(team =>
    team.weekScores.map(score => ({
      rosterId: team.rosterId,
      week: score.week,
      points: score.points,
      players: score.players,
    })),
  );
  const runs = buildWaiverRuns({
    transactions: transactions as ViewTransaction[],
    teams: league.teams,
    scores,
  });
  const names = new Map(league.teams.map(t => [t.rosterId, teamName(t)]));
  const weekFilter =
    weekParam === 'all' ? null : Number(weekParam) || runs[0]?.week || null;

  // Season totals per team, from every run.
  const totals = new Map(
    league.teams.map(t => [
      t.rosterId,
      { won: 0, lost: 0, spent: 0, biggest: 0 },
    ]),
  );
  for (const run of runs) {
    for (const claim of run.claims) {
      if (claim.winner) {
        const total = totals.get(claim.winner.rosterId);
        if (total) {
          total.won++;
          total.spent += claim.winner.bid;
          total.biggest = Math.max(total.biggest, claim.winner.bid);
        }
      }
      for (const bid of claim.losingBids) {
        const total = totals.get(bid.rosterId);
        if (total) total.lost++;
      }
    }
  }

  const allClaims = runs.flatMap(run =>
    run.claims.map(claim => ({ ...claim, week: run.week })),
  );
  const biggest = allClaims
    .filter(claim => claim.winner)
    .sort((a, b) => b.winner!.bid - a.winner!.bid)
    .slice(0, 10);

  const visibleRuns = runs
    .filter(run => !weekFilter || run.week === weekFilter)
    .map(run => ({
      ...run,
      claims: run.claims.filter(
        claim =>
          !teamFilter ||
          claim.winner?.rosterId === teamFilter ||
          claim.losingBids.some(bid => bid.rosterId === teamFilter),
      ),
    }))
    .filter(run => run.claims.length > 0);

  const players = await getPlayersBySleepersIds(
    Array.from(
      new Set([
        ...visibleRuns.flatMap(run => run.claims.map(c => c.sleeperId)),
        ...biggest.map(c => c.sleeperId),
      ]),
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
  const bidView = (bid: {
    rosterId: number;
    bid: number;
    notes: string | null;
  }) => ({
    name: names.get(bid.rosterId) ?? '',
    bid: bid.bid,
    notes: bid.notes,
  });

  return typedjson({
    budget: league.waiverBudget,
    weeks: runs.map(run => run.week),
    weekFilter,
    teamFilter,
    teams: league.teams
      .map(t => ({ rosterId: t.rosterId, name: names.get(t.rosterId) ?? '' }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    totals: league.teams
      .map(t => ({
        rosterId: t.rosterId,
        name: names.get(t.rosterId) ?? '',
        ...totals.get(t.rosterId)!,
        left: league.waiverBudget - t.waiverBudgetUsed,
      }))
      .sort((a, b) => b.spent - a.spent),
    biggest: biggest.map(claim => ({
      ...describe(claim.sleeperId),
      week: claim.week,
      winner: bidView(claim.winner!),
    })),
    runs: visibleRuns.map(run => ({
      week: run.week,
      claims: run.claims.map(claim => ({
        ...describe(claim.sleeperId),
        winner: claim.winner ? bidView(claim.winner) : null,
        losingBids: claim.losingBids.map(bidView),
        fromChop: claim.releasedBy
          ? names.get(claim.releasedBy.rosterId) ?? null
          : null,
      })),
    })),
  });
};

export default function GuillotineWaivers() {
  const {
    budget,
    weeks,
    weekFilter,
    teamFilter,
    teams,
    totals,
    biggest,
    runs,
  } = useTypedLoaderData<typeof loader>();
  const submit = useSubmit();

  const totalClaims = totals.reduce((sum, t) => sum + t.won, 0);
  const totalSpent = totals.reduce((sum, t) => sum + t.spent, 0);
  const totalLost = totals.reduce((sum, t) => sum + t.lost, 0);

  return (
    <div className='space-y-6'>
      <div className='not-prose grid grid-cols-2 gap-3 md:grid-cols-4'>
        <StatTile label='Claims Won' value={`${totalClaims}`} />
        <StatTile label='Bids That Lost' value={`${totalLost}`} />
        <StatTile label='FAAB Spent' value={`$${totalSpent}`} />
        <StatTile label='Budget Each' value={budget ? `$${budget}` : '—'} />
      </div>

      <ProfileSection
        title='Budgets'
        description='Every team’s season on the wire, biggest spenders first.'
      >
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-slate-400'>
                <th className='py-1 pr-2'>Team</th>
                <th className='py-1 pr-2 text-right'>Won</th>
                <th className='py-1 pr-2 text-right'>Lost</th>
                <th className='py-1 pr-2 text-right'>Spent</th>
                <th className='py-1 pr-2 text-right'>Biggest</th>
                <th className='py-1 text-right'>Left</th>
              </tr>
            </thead>
            <tbody>
              {totals.map(team => (
                <tr key={team.rosterId} className='border-t border-slate-700'>
                  <td className='py-1.5 pr-2 text-white'>{team.name}</td>
                  <td className='py-1.5 pr-2 text-right tabular-nums'>
                    {team.won}
                  </td>
                  <td className='py-1.5 pr-2 text-right tabular-nums'>
                    {team.lost}
                  </td>
                  <td className='py-1.5 pr-2 text-right tabular-nums'>
                    ${team.spent}
                  </td>
                  <td className='py-1.5 pr-2 text-right tabular-nums'>
                    {team.biggest ? `$${team.biggest}` : '—'}
                  </td>
                  <td className='py-1.5 text-right tabular-nums'>
                    {budget ? `$${team.left}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProfileSection>

      {biggest.length > 0 && (
        <ProfileSection title='Biggest Bids'>
          <ol className='m-0 list-none space-y-1 p-0 text-sm'>
            {biggest.map((claim, index) => (
              <li
                key={`${claim.sleeperId}-${claim.week}`}
                className='flex flex-wrap justify-between gap-x-3 border-t border-slate-700 pt-1'
              >
                <span className='text-white'>
                  <span className='mr-2 text-slate-500'>{index + 1}.</span>
                  <PlayerLabel player={claim} />
                </span>
                <span>
                  {claim.winner.name},{' '}
                  <span className='font-semibold text-white'>
                    ${claim.winner.bid}
                  </span>{' '}
                  <span className='text-slate-400'>for week {claim.week}</span>
                </span>
              </li>
            ))}
          </ol>
        </ProfileSection>
      )}

      <ProfileSection
        title='Every Claim'
        description='Each waiver run with every bid on every player. Pick all weeks to see the whole season.'
        action={
          <Form
            method='get'
            className='flex flex-wrap gap-2 text-sm'
            onChange={e => submit(e.currentTarget)}
          >
            <select
              name='week'
              defaultValue={weekFilter ?? 'all'}
              aria-label='Week'
              className='rounded border border-slate-600 bg-slate-900 px-2 py-1 text-white'
            >
              <option value='all'>All weeks</option>
              {weeks.map(week => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))}
            </select>
            <select
              name='team'
              defaultValue={teamFilter ?? ''}
              aria-label='Team'
              className='rounded border border-slate-600 bg-slate-900 px-2 py-1 text-white'
            >
              <option value=''>All teams</option>
              {teams.map(team => (
                <option key={team.rosterId} value={team.rosterId}>
                  {team.name}
                </option>
              ))}
            </select>
            <noscript>
              <button type='submit'>Filter</button>
            </noscript>
          </Form>
        }
      >
        {runs.length === 0 && (
          <p className='m-0 text-sm text-slate-400'>No claims match.</p>
        )}
        <div className='space-y-5'>
          {runs.map(run => (
            <div key={run.week}>
              <h4 className='m-0 mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400'>
                For week {run.week}
              </h4>
              <table className='w-full text-sm'>
                <tbody>
                  {run.claims.map(claim => (
                    <tr
                      key={claim.sleeperId}
                      className='border-t border-slate-700 align-top'
                    >
                      <td className='py-1.5 pr-2 text-white'>
                        <PlayerLabel player={claim} />
                        {claim.fromChop && (
                          <div className='text-xs text-slate-400'>
                            from {claim.fromChop}
                          </div>
                        )}
                      </td>
                      <td className='py-1.5 pr-2'>
                        {claim.winner ? (
                          <span className='text-emerald-300'>
                            {claim.winner.name} ${claim.winner.bid}
                          </span>
                        ) : (
                          <span className='text-slate-500'>
                            No claim went through
                          </span>
                        )}
                        {claim.losingBids.length > 0 && (
                          <div className='text-xs text-slate-400'>
                            {claim.losingBids
                              .map(bid => `${bid.name} $${bid.bid}`)
                              .join(' · ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </ProfileSection>
    </div>
  );
}
