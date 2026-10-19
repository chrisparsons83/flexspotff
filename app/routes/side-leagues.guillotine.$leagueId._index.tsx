import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import LiveChopLinePanel from '~/components/layout/guillotine/LiveChopLinePanel';
import { ScoreGrid } from '~/components/layout/side-leagues/ScoreGrid';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { requireGuillotineAccess } from '~/libs/guillotine/access.server';
import { GUILLOTINE_FINAL_WEEK } from '~/libs/guillotine/chops';
import { ordinal, pts, teamName } from '~/libs/guillotine/display';
import { buildLiveChopLine } from '~/libs/guillotine/live.server';
import { buildChopGrid, buildStandings } from '~/libs/guillotine/views';
import type { GridCell, StandingRow } from '~/libs/guillotine/views';
import { getGuillotineLeagueForPage } from '~/models/guillotine.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireGuillotineAccess(request);

  const league = await getGuillotineLeagueForPage(params.leagueId ?? '');
  if (!league) throw new Response('League not found', { status: 404 });

  const scores = league.teams.flatMap(team =>
    team.weekScores.map(score => ({
      rosterId: team.rosterId,
      week: score.week,
      points: score.points,
      players: score.players,
    })),
  );

  const liveWeek =
    !league.isComplete && league.lastScoredWeek < GUILLOTINE_FINAL_WEEK
      ? league.lastScoredWeek + 1
      : null;
  const hasLiveScores =
    liveWeek !== null && scores.some(score => score.week === liveWeek);

  const live =
    liveWeek && hasLiveScores
      ? await buildLiveChopLine({
          year: league.season.year,
          week: liveWeek,
          teams: league.teams,
        })
      : null;

  const standings = buildStandings({
    teams: league.teams,
    scores,
    lastScoredWeek: league.lastScoredWeek,
  });
  const grid = buildChopGrid({
    teams: league.teams,
    scores,
    throughWeek: league.lastScoredWeek,
  });

  const names = new Map(league.teams.map(t => [t.rosterId, teamName(t)]));
  const faabLeft = new Map(
    league.teams.map(t => [
      t.rosterId,
      league.waiverBudget - t.waiverBudgetUsed,
    ]),
  );

  return typedjson({
    leagueId: league.id,
    lastScoredWeek: league.lastScoredWeek,
    liveWeek: hasLiveScores ? liveWeek : null,
    live,
    standings: standings.map(row => ({
      ...row,
      name: names.get(row.rosterId) ?? '',
      faabLeft: league.waiverBudget ? faabLeft.get(row.rosterId) ?? null : null,
    })),
    grid: standings.map(row => ({
      rosterId: row.rosterId,
      name: names.get(row.rosterId) ?? '',
      cells: Object.fromEntries(grid.get(row.rosterId) ?? []) as Record<
        number,
        GridCell
      >,
    })),
    names: Object.fromEntries(names) as Record<number, string>,
  });
};

export default function GuillotineChopTracker() {
  const { leagueId, lastScoredWeek, liveWeek, live, standings, grid, names } =
    useTypedLoaderData<typeof loader>();

  return (
    <>
      {live && liveWeek && (
        <LiveChopLinePanel
          week={liveWeek}
          live={live}
          names={names}
          leagueId={leagueId}
        />
      )}
      <Standings rows={standings} />
      {lastScoredWeek > 0 && (
        <ChopGrid rows={grid} weeks={lastScoredWeek} leagueId={leagueId} />
      )}
    </>
  );
}

function Standings({
  rows,
}: {
  rows: (StandingRow & { name: string; faabLeft: number | null })[];
}) {
  const showFaab = rows.some(row => row.faabLeft !== null);

  return (
    <Section
      title='Standings'
      description='Survivors first, then everyone else in the order they went.'
    >
      <Table
        headers={[
          'Place',
          'Team',
          'Chopped',
          'Average',
          'Best week',
          'Closest escape',
          ...(showFaab ? ['FAAB left'] : []),
        ]}
        numericColumns={[3, 4, 5, 6]}
        primaryColumns={[1, 2]}
      >
        {rows.map(row => (
          <tr key={row.rosterId}>
            <td>
              {row.place === 1 ? (
                <span className='font-semibold'>Champion</span>
              ) : row.alive ? (
                <span className='text-positive'>Alive</span>
              ) : row.place ? (
                ordinal(row.place)
              ) : (
                '–'
              )}
            </td>
            <td>{row.name}</td>
            <td>{row.choppedWeek ? `Week ${row.choppedWeek}` : '–'}</td>
            <td className='text-right'>{pts(row.averagePoints)}</td>
            <td className='text-right'>
              {row.bestWeek
                ? `${pts(row.bestWeek.points)}, week ${row.bestWeek.week}`
                : '–'}
            </td>
            <td className='text-right'>
              {row.closestEscape
                ? `+${pts(row.closestEscape.margin)}, week ${
                    row.closestEscape.week
                  }`
                : '–'}
            </td>
            {showFaab && (
              <td className='text-right'>
                {row.faabLeft === null ? '–' : `$${row.faabLeft}`}
              </td>
            )}
          </tr>
        ))}
      </Table>
    </Section>
  );
}

/** How safe a score was: the further above the chop line, the greener. */
const cellTone = (cell: GridCell) => {
  if (cell.chopped)
    return 'bg-destructive text-destructive-foreground font-semibold';
  if (cell.margin === null) return 'bg-muted';
  if (cell.margin < 5) return 'bg-warning/30';
  if (cell.margin < 15) return 'bg-secondary';
  if (cell.rank <= 3) return 'bg-positive/30';
  return 'bg-muted';
};

function ChopGrid({
  rows,
  weeks,
  leagueId,
}: {
  rows: {
    rosterId: number;
    name: string;
    cells: Record<number, GridCell>;
  }[];
  weeks: number;
  leagueId: string;
}) {
  return (
    <Section
      title='Chop tracker'
      description='Every score, week by week. Red is the chop, amber survived by under 5 points, green was a top-three week.'
    >
      <ScoreGrid
        rows={rows.map(row => ({ ...row, key: row.rosterId }))}
        weeks={weeks}
        weekHref={week => `/side-leagues/guillotine/${leagueId}/week/${week}`}
        cell={(row, week) => {
          const cell = row.cells[week];
          if (!cell) return null;
          return {
            value: cell.points.toFixed(1),
            tone: cellTone(cell),
            title: `Week ${week}: ${pts(cell.points)} pts, ${ordinal(
              cell.rank,
            )} of the week${
              cell.margin !== null && !cell.chopped
                ? `, ${pts(cell.margin)} above the chop`
                : ''
            }`,
          };
        }}
      />
    </Section>
  );
}
