import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { PositionTally } from '~/components/layout/best-ball/PositionCounts';
import { ScoreGrid } from '~/components/layout/side-leagues/ScoreGrid';
import { EmptyState } from '~/components/ui/empty-state';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
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
    return <EmptyState title='Nothing synced from Sleeper yet' />;
  }

  return (
    <>
      <Section
        title='Standings'
        description={
          isComplete
            ? 'Final, by points for through week 17.'
            : 'By points for so far. Only points count; the record does not.'
        }
      >
        <Table
          headers={[
            'Place',
            'Team',
            'Points for',
            'Back',
            'Best week',
            'Top weeks',
            'Slot',
            'Drafted',
          ]}
          numericColumns={[2, 3, 4, 5, 6]}
          primaryColumns={[1, 2]}
        >
          {rows.map(row => (
            <tr key={row.rosterId}>
              <td>
                {isComplete && row.rank === 1 ? (
                  <span className='font-semibold'>Champion</span>
                ) : (
                  ordinal(row.rank)
                )}
              </td>
              <td>
                <TeamName row={row} />
              </td>
              <td className='text-right font-semibold'>{pts(row.pointsFor)}</td>
              <td className='text-right text-muted-foreground'>
                {row.gap > 0 ? `−${pts(row.gap)}` : '–'}
              </td>
              <td className='text-right'>
                {row.bestWeek
                  ? `${pts(row.bestWeek.points)}, week ${row.bestWeek.week}`
                  : '–'}
              </td>
              <td className='text-right'>{row.topScores || '–'}</td>
              <td className='text-right'>{row.draftSlot ?? '–'}</td>
              <td>
                <PositionTally counts={row.positions} />
              </td>
            </tr>
          ))}
        </Table>
      </Section>

      {weeks > 0 && <WeeklyGrid rows={rows} weeks={weeks} highs={highs} />}
    </>
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
    <Section
      title='Week by week'
      description='Each week’s best-ball score. Green was the top score that week, red the lowest.'
    >
      <ScoreGrid
        rows={rows.map(row => ({ ...row, key: row.rosterId }))}
        weeks={weeks}
        cell={(row, week) => {
          const points = row.weeks[week];
          if (points === undefined) return null;
          return {
            value: points.toFixed(1),
            title: `Week ${week}: ${pts(points)} pts`,
            tone:
              points > 0 && points === highs[week]
                ? 'bg-positive/30 font-semibold'
                : points === lows[week]
                ? 'bg-destructive/30'
                : 'bg-muted',
          };
        }}
      />
    </Section>
  );
}
