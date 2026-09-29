import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link } from '@remix-run/react';
import clsx from 'clsx';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import LiveChopLinePanel from '~/components/layout/guillotine/LiveChopLinePanel';
import ProfileSection from '~/components/layout/profile/ProfileSection';
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
    <div className='space-y-6'>
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
    </div>
  );
}

function Standings({
  rows,
}: {
  rows: (StandingRow & { name: string; faabLeft: number | null })[];
}) {
  const showFaab = rows.some(row => row.faabLeft !== null);

  return (
    <ProfileSection
      title='Standings'
      description='Survivors first, then everyone else in the order they went.'
    >
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='text-left text-slate-400'>
              <th className='py-1 pr-2'>Place</th>
              <th className='py-1 pr-2'>Team</th>
              <th className='py-1 pr-2'>Chopped</th>
              <th className='py-1 pr-2 text-right'>Avg</th>
              <th className='py-1 pr-2 text-right'>Best Week</th>
              <th className='py-1 pr-2 text-right'>Closest Escape</th>
              {showFaab && <th className='py-1 text-right'>FAAB Left</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.rosterId} className='border-t border-slate-700'>
                <td className='py-1.5 pr-2'>
                  {row.place === 1 ? (
                    <span className='font-semibold text-amber-300'>
                      Champion
                    </span>
                  ) : row.alive ? (
                    <span className='text-emerald-300'>Alive</span>
                  ) : row.place ? (
                    ordinal(row.place)
                  ) : (
                    '—'
                  )}
                </td>
                <td className='py-1.5 pr-2 text-white'>{row.name}</td>
                <td className='py-1.5 pr-2'>
                  {row.choppedWeek ? `Week ${row.choppedWeek}` : '—'}
                </td>
                <td className='py-1.5 pr-2 text-right tabular-nums'>
                  {pts(row.averagePoints)}
                </td>
                <td className='py-1.5 pr-2 text-right tabular-nums'>
                  {row.bestWeek
                    ? `${pts(row.bestWeek.points)} (Wk ${row.bestWeek.week})`
                    : '—'}
                </td>
                <td className='py-1.5 pr-2 text-right tabular-nums'>
                  {row.closestEscape
                    ? `+${pts(row.closestEscape.margin)} (Wk ${
                        row.closestEscape.week
                      })`
                    : '—'}
                </td>
                {showFaab && (
                  <td className='py-1.5 text-right tabular-nums'>
                    {row.faabLeft === null ? '—' : `$${row.faabLeft}`}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProfileSection>
  );
}

/** How safe a score was: the further above the chop line, the greener. */
const cellTone = (cell: GridCell) => {
  if (cell.chopped) return 'bg-rose-700 text-white font-semibold';
  if (cell.margin === null) return 'bg-slate-700/60';
  if (cell.margin < 5) return 'bg-amber-600/60 text-white';
  if (cell.margin < 15) return 'bg-slate-600/70';
  if (cell.rank <= 3) return 'bg-emerald-700/70 text-white';
  return 'bg-slate-700/60';
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
  const weekNumbers = Array.from({ length: weeks }, (_, i) => i + 1);

  return (
    <ProfileSection
      title='Chop Tracker'
      description='Every score, week by week. Red is the chop, amber survived by under 5 points, green was a top-three week.'
    >
      <div className='overflow-x-auto'>
        <table className='border-separate border-spacing-0.5 text-xs'>
          <thead>
            <tr>
              <th className='sticky left-0 z-10 bg-slate-800 pr-2 text-left text-slate-400'>
                Team
              </th>
              {weekNumbers.map(week => (
                <th key={week} className='min-w-[3.25rem] text-slate-400'>
                  <Link
                    to={`/games/guillotine/${leagueId}/week/${week}`}
                    className='text-slate-400 no-underline hover:text-white'
                  >
                    {week}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.rosterId}>
                <td className='sticky left-0 z-10 max-w-[10rem] truncate bg-slate-800 pr-2 text-white'>
                  {row.name}
                </td>
                {weekNumbers.map(week => {
                  const cell = row.cells[week];
                  return (
                    <td
                      key={week}
                      title={
                        cell
                          ? `Week ${week}: ${pts(cell.points)} pts, ${ordinal(
                              cell.rank,
                            )} of the week${
                              cell.margin !== null && !cell.chopped
                                ? `, ${pts(cell.margin)} above the chop`
                                : ''
                            }`
                          : undefined
                      }
                      className={clsx(
                        'rounded px-1 py-1 text-center tabular-nums',
                        cell ? cellTone(cell) : 'text-slate-600',
                      )}
                    >
                      {cell ? cell.points.toFixed(1) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProfileSection>
  );
}
