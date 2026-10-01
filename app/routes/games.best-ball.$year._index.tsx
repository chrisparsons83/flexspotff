import type { LoaderFunctionArgs } from '@remix-run/node';
import clsx from 'clsx';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { PositionChips } from '~/components/layout/best-ball/PositionCounts';
import ProfileLink from '~/components/layout/profile/ProfileLink';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import { requireBestBallAccess } from '~/libs/best-ball/access.server';
import {
  buildStandings,
  emptyPositionCounts,
  positionCounts,
  weeklyHighs,
} from '~/libs/best-ball/views';
import type { PositionCounts } from '~/libs/best-ball/views';
import { ordinal, pts, teamName } from '~/libs/guillotine/display';
import {
  getBestBallDraftPicks,
  getBestBallLeagueForPage,
} from '~/models/bestball.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireBestBallAccess(request);

  const league = await getBestBallLeagueForPage(Number(params.year));
  if (!league) throw new Response('Season not found', { status: 404 });
  const picks = await getBestBallDraftPicks(league.id);

  const countsByRoster = new Map<number, PositionCounts>();
  for (const team of league.teams) {
    countsByRoster.set(
      team.rosterId,
      positionCounts(picks.filter(p => p.rosterId === team.rosterId)),
    );
  }

  const standings = buildStandings(league.teams);
  const highs = weeklyHighs(league.teams);
  const weeks = Math.max(0, ...[...highs.keys()]);

  return typedjson({
    isComplete: league.isComplete,
    weeks,
    highs: Object.fromEntries(highs) as Record<number, number>,
    rows: standings.map(row => ({
      rosterId: row.rosterId,
      name: teamName(row),
      userId: row.user?.id ?? null,
      rank: row.rank,
      pointsFor: row.pointsFor,
      gap: row.gap,
      bestWeek: row.bestWeek,
      topScores: row.topScores,
      draftSlot: row.draftSlot,
      positions: countsByRoster.get(row.rosterId) ?? emptyPositionCounts(),
      weeks: Object.fromEntries(
        row.weekScores.map(s => [s.week, s.points]),
      ) as Record<number, number>,
    })),
  });
};

type Row = ReturnType<typeof useTypedLoaderData<typeof loader>>['rows'][number];

function TeamName({ row }: { row: Row }) {
  return row.userId ? (
    <ProfileLink userId={row.userId}>{row.name}</ProfileLink>
  ) : (
    <>{row.name}</>
  );
}

export default function BestBallStandings() {
  const { isComplete, rows, weeks, highs } =
    useTypedLoaderData<typeof loader>();

  if (rows.length === 0) {
    return <p>Nothing synced from Sleeper yet.</p>;
  }

  return (
    <div className='space-y-6'>
      <ProfileSection
        title='Standings'
        description={
          isComplete
            ? 'Final, by points for through week 17.'
            : 'By points for so far. Only points count; the record does not.'
        }
      >
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-slate-400'>
                <th className='py-1 pr-2'>Place</th>
                <th className='py-1 pr-2'>Team</th>
                <th className='py-1 pr-2 text-right'>Points For</th>
                <th className='py-1 pr-2 text-right'>Back</th>
                <th className='py-1 pr-2 text-right'>Best Week</th>
                <th
                  className='py-1 pr-2 text-right'
                  title="Weeks with the league's top score"
                >
                  Top Wks
                </th>
                <th className='py-1 pr-2 text-right'>Slot</th>
                <th className='py-1'>Drafted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.rosterId} className='border-t border-slate-700'>
                  <td className='py-1.5 pr-2'>
                    {isComplete && row.rank === 1 ? (
                      <span className='font-semibold text-amber-300'>
                        Champion
                      </span>
                    ) : (
                      ordinal(row.rank)
                    )}
                  </td>
                  <td className='py-1.5 pr-2 text-white'>
                    <TeamName row={row} />
                  </td>
                  <td className='py-1.5 pr-2 text-right font-semibold tabular-nums text-white'>
                    {pts(row.pointsFor)}
                  </td>
                  <td className='py-1.5 pr-2 text-right tabular-nums text-slate-300'>
                    {row.gap > 0 ? `-${pts(row.gap)}` : '—'}
                  </td>
                  <td className='py-1.5 pr-2 text-right tabular-nums'>
                    {row.bestWeek
                      ? `${pts(row.bestWeek.points)} (Wk ${row.bestWeek.week})`
                      : '—'}
                  </td>
                  <td className='py-1.5 pr-2 text-right tabular-nums'>
                    {row.topScores || '—'}
                  </td>
                  <td className='py-1.5 pr-2 text-right tabular-nums'>
                    {row.draftSlot ?? '—'}
                  </td>
                  <td className='py-1.5'>
                    <PositionChips counts={row.positions} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProfileSection>

      {weeks > 0 && <WeeklyGrid rows={rows} weeks={weeks} highs={highs} />}
    </div>
  );
}

function WeeklyGrid({
  rows,
  weeks,
  highs,
}: {
  rows: Row[];
  weeks: number;
  highs: Record<number, number>;
}) {
  const weekNumbers = Array.from({ length: weeks }, (_, i) => i + 1);
  const lows = Object.fromEntries(
    weekNumbers.map(week => [
      week,
      Math.min(...rows.map(r => r.weeks[week]).filter(p => p !== undefined)),
    ]),
  ) as Record<number, number>;

  return (
    <ProfileSection
      title='Week by Week'
      description="Each week's best-ball score. Green was the top score that week, red the lowest."
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
                  {week}
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
                  const points = row.weeks[week];
                  return (
                    <td
                      key={week}
                      title={
                        points === undefined
                          ? undefined
                          : `Week ${week}: ${pts(points)} pts`
                      }
                      className={clsx(
                        'rounded px-1 py-1 text-center tabular-nums',
                        points === undefined
                          ? 'text-slate-600'
                          : points > 0 && points === highs[week]
                          ? 'bg-emerald-700/70 font-semibold text-white'
                          : points === lows[week]
                          ? 'bg-rose-800/70 text-white'
                          : 'bg-slate-700/60',
                      )}
                    >
                      {points === undefined ? '' : points.toFixed(1)}
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
