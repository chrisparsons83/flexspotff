import type { LoaderFunctionArgs } from '@remix-run/node';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { PositionChips } from '~/components/layout/best-ball/PositionCounts';
import DraftBoard, {
  DraftBoardCell,
} from '~/components/layout/draftboard/DraftBoard';
import ProfileSection from '~/components/layout/profile/ProfileSection';
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
import { POSITION_TINT_COLORS } from '~/utils/constants';

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
    return <p>The draft has not happened yet.</p>;
  }

  return (
    <div className='space-y-6'>
      <ProfileSection
        title='What the CPU Drafted'
        description='Every roster by position, with the oddities the autodraft left behind.'
      >
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-slate-400'>
                <th className='py-1 pr-2'>Slot</th>
                <th className='py-1 pr-2'>Team</th>
                <th className='py-1 pr-2'>Positions</th>
                <th className='py-1'>Notable</th>
              </tr>
            </thead>
            <tbody>
              {columns.map(column => (
                <tr key={column.rosterId} className='border-t border-slate-700'>
                  <td className='py-1.5 pr-2 tabular-nums'>{column.slot}</td>
                  <td className='py-1.5 pr-2 text-white'>{column.name}</td>
                  <td className='py-1.5 pr-2'>
                    <PositionChips counts={column.counts} />
                  </td>
                  <td className='py-1.5 text-xs text-amber-200'>
                    {column.outliers.join(' · ') || '—'}
                  </td>
                </tr>
              ))}
              {average && (
                <tr className='border-t border-slate-600 text-slate-400'>
                  <td className='py-1.5 pr-2' />
                  <td className='py-1.5 pr-2'>League average</td>
                  <td className='py-1.5 pr-2 text-xs' colSpan={2}>
                    QB {average.QB} · RB {average.RB} · WR {average.WR} · TE{' '}
                    {average.TE}
                    {average.Other > 0 ? ` · Other ${average.Other}` : ''}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ProfileSection>

      <ProfileSection
        title='Draft Board'
        description='One column per team in draft order.'
      >
        <DraftBoard
          columns={columns}
          rounds={rounds}
          columnKey={column => column.rosterId}
          snake
          renderHeader={column => (
            <div className='flex h-14 flex-col justify-between rounded bg-slate-900/70 p-1 text-center'>
              <div className='truncate font-semibold text-white'>
                {column.name}
              </div>
              <div className='text-[0.7rem] tabular-nums text-slate-400'>
                {column.pointsFor.toFixed(1)} pts
              </div>
            </div>
          )}
          renderCell={(column, round) => {
            const pick = column.picks.find(p => p.round === round);
            if (!pick) return null;
            return (
              <DraftBoardCell
                title={shortName(pick.playerName)}
                subtitle={
                  <span className='flex items-center gap-1'>
                    <span className='font-semibold text-white'>
                      {pick.position}
                    </span>
                    <span className='text-white/70'>
                      {pick.nflTeam ?? 'FA'}
                    </span>
                  </span>
                }
                corner={
                  <span className='tabular-nums text-white/60'>
                    {pick.pickNo}
                  </span>
                }
                tone={
                  POSITION_TINT_COLORS[pick.position.toLowerCase()] ??
                  'bg-slate-700/60'
                }
                tooltip={`${pick.playerName} · pick ${pick.pickNo} by ${column.name}`}
                highlighted={hovered === pick.sleeperId}
                dimmed={hovered !== null && hovered !== pick.sleeperId}
                onMouseEnter={() => setHovered(pick.sleeperId)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          }}
        />
      </ProfileSection>
    </div>
  );
}
