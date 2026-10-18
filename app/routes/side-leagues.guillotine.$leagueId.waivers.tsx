import type { LoaderFunctionArgs } from '@remix-run/node';
import { Form, useSubmit } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { Button } from '~/components/ui/button';
import { EmptyState } from '~/components/ui/empty-state';
import { NativeSelect } from '~/components/ui/input';
import { PlayerLabel } from '~/components/ui/player-label';
import { Section } from '~/components/ui/section';
import { StatList } from '~/components/ui/stat-list';
import { Table } from '~/components/ui/table';
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
    <>
      <StatList
        className='mb-16 grid-cols-2 md:grid-cols-4'
        stats={[
          { label: 'Claims won', value: totalClaims },
          { label: 'Bids that lost', value: totalLost },
          { label: 'FAAB spent', value: `$${totalSpent}` },
          { label: 'Budget each', value: budget ? `$${budget}` : '–' },
        ]}
      />

      <Section
        title='Budgets'
        description='Every team’s season on the wire, biggest spenders first.'
      >
        <Table
          headers={['Team', 'Won', 'Lost', 'Spent', 'Biggest', 'Left']}
          numericColumns={[1, 2, 3, 4, 5]}
          primaryColumns={[3, 5]}
        >
          {totals.map(team => (
            <tr key={team.rosterId}>
              <td>{team.name}</td>
              <td className='text-right'>{team.won}</td>
              <td className='text-right'>{team.lost}</td>
              <td className='text-right'>${team.spent}</td>
              <td className='text-right'>
                {team.biggest ? `$${team.biggest}` : '–'}
              </td>
              <td className='text-right'>{budget ? `$${team.left}` : '–'}</td>
            </tr>
          ))}
        </Table>
      </Section>

      {biggest.length > 0 && (
        <Section title='Biggest bids'>
          <Table
            headers={['Rank', 'Player', 'Team', 'Bid', 'For week']}
            numericColumns={[0, 3, 4]}
            primaryColumns={[1, 3]}
          >
            {biggest.map((claim, index) => (
              <tr key={`${claim.sleeperId}-${claim.week}`}>
                <td className='text-right text-muted-foreground'>
                  {index + 1}
                </td>
                <td>
                  <PlayerLabel player={claim} />
                </td>
                <td>{claim.winner.name}</td>
                <td className='text-right font-semibold'>
                  ${claim.winner.bid}
                </td>
                <td className='text-right'>{claim.week}</td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      <Section
        title='Every claim'
        description='Each waiver run with every bid on every player. Pick all weeks to see the whole season.'
        action={
          <Form
            method='get'
            className='flex flex-wrap gap-2'
            onChange={e => submit(e.currentTarget)}
          >
            <NativeSelect
              name='week'
              defaultValue={weekFilter ?? 'all'}
              aria-label='Week'
              className='w-auto'
            >
              <option value='all'>All weeks</option>
              {weeks.map(week => (
                <option key={week} value={week}>
                  Week {week}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              name='team'
              defaultValue={teamFilter ?? ''}
              aria-label='Team'
              className='w-auto'
            >
              <option value=''>All teams</option>
              {teams.map(team => (
                <option key={team.rosterId} value={team.rosterId}>
                  {team.name}
                </option>
              ))}
            </NativeSelect>
            <noscript>
              <Button type='submit' variant='secondary'>
                Filter
              </Button>
            </noscript>
          </Form>
        }
      >
        {runs.length === 0 && <EmptyState title='No claims match' />}
        {runs.map(run => (
          <Section
            key={run.week}
            as='h3'
            title={`For week ${run.week}`}
            className='mt-10'
          >
            <Table
              headers={['Player', 'Winning bid', 'Losing bids']}
              primaryColumns={[1]}
            >
              {run.claims.map(claim => (
                <tr key={claim.sleeperId} className='align-top'>
                  <td>
                    <PlayerLabel player={claim} />
                    {claim.fromChop && (
                      <div className='text-sm text-muted-foreground'>
                        from {claim.fromChop}
                      </div>
                    )}
                  </td>
                  <td>
                    {claim.winner ? (
                      `${claim.winner.name} $${claim.winner.bid}`
                    ) : (
                      <span className='text-muted-foreground'>
                        No claim went through
                      </span>
                    )}
                  </td>
                  <td>
                    <ul className='text-sm text-muted-foreground'>
                      {claim.losingBids.map((bid, index) => (
                        <li key={index}>
                          {bid.name} ${bid.bid}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </Table>
          </Section>
        ))}
      </Section>
    </>
  );
}
