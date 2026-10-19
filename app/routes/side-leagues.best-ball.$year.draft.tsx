import type { LoaderFunctionArgs } from '@remix-run/node';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { PositionTally } from '~/components/layout/best-ball/PositionCounts';
import {
  DraftBoard,
  DraftBoardCell,
  DraftBoardHeader,
} from '~/components/ui/draft-board';
import { EmptyState } from '~/components/ui/empty-state';
import { positionTint } from '~/components/ui/fills';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { requireBestBallAccess } from '~/libs/best-ball/access.server';
import {
  averagePositionCounts,
  draftOutliers,
  positionCounts,
} from '~/libs/best-ball/views';
import type { PositionCounts } from '~/libs/best-ball/views';
import { teamName } from '~/libs/guillotine/display';
import {
  getBestBallDraftPicks,
  getBestBallLeagueForPage,
} from '~/models/bestball.server';
import { type RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  width: 'full',
  title: 'Draft',
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireBestBallAccess(request);

  const league = await getBestBallLeagueForPage(Number(params.year));
  if (!league) throw new Response('Season not found', { status: 404 });
  const picks = await getBestBallDraftPicks(league.id);

  const countsByRoster = new Map<number, PositionCounts>(
    league.teams.map(team => [
      team.rosterId,
      positionCounts(picks.filter(p => p.rosterId === team.rosterId)),
    ]),
  );
  const outliers = draftOutliers(countsByRoster);

  const columns = league.teams
    .map(team => {
      const teamPicks = picks.filter(p => p.rosterId === team.rosterId);
      return {
        rosterId: team.rosterId,
        // Picks carry their slot even when the team record has none.
        slot: team.draftSlot ?? teamPicks[0]?.draftSlot ?? 99,
        name: teamName(team),
        pointsFor: team.pointsFor,
        counts: countsByRoster.get(team.rosterId)!,
        outliers: outliers
          .filter(o => o.rosterId === team.rosterId)
          .map(o => o.label),
        picks: teamPicks,
      };
    })
    .sort((a, b) => a.slot - b.slot);

  return typedjson({
    columns,
    rounds: Math.max(0, ...picks.map(p => p.round)),
    average: averagePositionCounts([...countsByRoster.values()]),
  });
};

const shortName = (name: string) => {
  const [first, ...rest] = name.split(' ');
  return rest.length > 0 ? `${first.charAt(0)}. ${rest.join(' ')}` : name;
};

export default function BestBallDraft() {
  const { columns, rounds, average } = useTypedLoaderData<typeof loader>();
  const [hovered, setHovered] = useState<string | null>(null);

  if (columns.length === 0 || rounds === 0) {
    return <EmptyState title='The draft has not happened yet' />;
  }

  return (
    <>
      <Section
        title='What the CPU drafted'
        description='Every roster by position, with the oddities the autodraft left behind.'
      >
        <Table
          headers={['Slot', 'Team', 'Positions', 'Notable']}
          numericColumns={[0]}
          primaryColumns={[1]}
          footer={
            average && (
              <tr className='text-muted-foreground'>
                <td />
                <td>League average</td>
                <td colSpan={2}>
                  <span className='inline-flex flex-wrap gap-x-3 text-sm'>
                    <span>QB {average.QB}</span>
                    <span>RB {average.RB}</span>
                    <span>WR {average.WR}</span>
                    <span>TE {average.TE}</span>
                    {average.Other > 0 && <span>Other {average.Other}</span>}
                  </span>
                </td>
              </tr>
            )
          }
        >
          {columns.map(column => (
            <tr key={column.rosterId}>
              <td className='text-right'>{column.slot}</td>
              <td>{column.name}</td>
              <td>
                <PositionTally counts={column.counts} />
              </td>
              <td className='text-sm'>
                {column.outliers.length > 0 ? (
                  <ul>
                    {column.outliers.map(outlier => (
                      <li key={outlier}>{outlier}</li>
                    ))}
                  </ul>
                ) : (
                  '–'
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section
        title='Draft board'
        description='One column per team in draft order.'
      >
        <DraftBoard
          columns={columns}
          rounds={rounds}
          columnKey={column => column.rosterId}
          renderHeader={column => (
            <DraftBoardHeader
              title={column.name}
              subtitle={`${column.pointsFor.toFixed(1)} pts`}
            />
          )}
          renderCell={(column, round) => {
            const pick = column.picks.find(p => p.round === round);
            if (!pick) return null;
            return (
              <DraftBoardCell
                title={shortName(pick.playerName)}
                subtitle={`${pick.position} ${pick.nflTeam ?? 'FA'}`}
                corner={pick.pickNo}
                tone={positionTint(pick.position)}
                tooltip={`${pick.playerName}, pick ${pick.pickNo} by ${column.name}`}
                highlighted={hovered === pick.sleeperId}
                dimmed={hovered !== null && hovered !== pick.sleeperId}
                onMouseEnter={() => setHovered(pick.sleeperId)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          }}
        />
      </Section>
    </>
  );
}
