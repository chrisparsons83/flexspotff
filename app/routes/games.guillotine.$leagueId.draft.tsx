import type { LoaderFunctionArgs } from '@remix-run/node';
import clsx from 'clsx';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import DraftBoard, {
  DraftBoardCell,
} from '~/components/layout/draftboard/DraftBoard';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import { requireGuillotineAccess } from '~/libs/guillotine/access.server';
import { ordinal, teamName } from '~/libs/guillotine/display';
import {
  getGuillotineDraftPicks,
  getGuillotineLeagueForPage,
} from '~/models/guillotine.server';
import { getPlayersBySleepersIds } from '~/models/players.server';
import { POSITION_TINT_COLORS } from '~/utils/constants';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireGuillotineAccess(request);

  const [league, picks] = await Promise.all([
    getGuillotineLeagueForPage(params.leagueId ?? ''),
    getGuillotineDraftPicks(params.leagueId ?? ''),
  ]);
  if (!league) throw new Response('League not found', { status: 404 });

  const players = await getPlayersBySleepersIds(picks.map(p => p.sleeperId));
  const playerById = new Map(players.map(p => [p.sleeperId, p]));

  const columns = league.teams
    .filter(team => team.draftSlot !== null)
    .sort((a, b) => (a.draftSlot ?? 0) - (b.draftSlot ?? 0))
    .map(team => ({
      rosterId: team.rosterId,
      slot: team.draftSlot!,
      name: teamName(team),
      fate:
        team.finish === 1
          ? 'Champion'
          : team.choppedWeek
          ? `${ordinal(team.finish ?? 0)} · wk ${team.choppedWeek}`
          : 'Alive',
      picks: picks
        .filter(pick => pick.rosterId === team.rosterId)
        .map(pick => {
          const player = playerById.get(pick.sleeperId);
          return {
            pickNo: pick.pickNo,
            round: pick.round,
            sleeperId: pick.sleeperId,
            firstName: player?.firstName ?? null,
            lastName: player?.lastName ?? null,
            fullName: player?.fullName ?? pick.sleeperId,
            position: player?.position ?? null,
            nflTeam: player?.nflTeam ?? null,
          };
        }),
    }));

  return typedjson({
    columns,
    rounds: Math.max(0, ...picks.map(p => p.round)),
  });
};

type Pick = {
  pickNo: number;
  round: number;
  sleeperId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  position: string | null;
  nflTeam: string | null;
};

const shortName = (pick: Pick) =>
  pick.firstName && pick.lastName
    ? `${pick.firstName.charAt(0)}. ${pick.lastName}`
    : pick.fullName;

export default function GuillotineDraft() {
  const { columns, rounds } = useTypedLoaderData<typeof loader>();
  const [hovered, setHovered] = useState<string | null>(null);

  if (columns.length === 0 || rounds === 0) {
    return <p>The draft has not happened yet.</p>;
  }

  return (
    <ProfileSection
      title='Draft Board'
      description='One column per team in draft order, with how far each team got.'
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
            <div
              className={clsx(
                'text-[0.7rem]',
                column.fate === 'Champion'
                  ? 'font-semibold text-amber-300'
                  : column.fate === 'Alive'
                  ? 'text-emerald-300'
                  : 'text-slate-400',
              )}
            >
              {column.fate}
            </div>
          </div>
        )}
        renderCell={(column, round) => {
          const pick = column.picks.find(p => p.round === round);
          if (!pick) return null;
          return (
            <DraftBoardCell
              title={shortName(pick)}
              subtitle={
                <span className='flex items-center gap-1'>
                  <span className='font-semibold text-white'>
                    {pick.position ?? '?'}
                  </span>
                  <span className='text-white/70'>{pick.nflTeam ?? 'FA'}</span>
                </span>
              }
              corner={
                <span className='tabular-nums text-white/60'>
                  {pick.pickNo}
                </span>
              }
              tone={
                POSITION_TINT_COLORS[pick.position?.toLowerCase() ?? ''] ??
                'bg-slate-700/60'
              }
              tooltip={`${pick.fullName} · pick ${pick.pickNo} by ${column.name}`}
              highlighted={hovered === pick.sleeperId}
              dimmed={hovered !== null && hovered !== pick.sleeperId}
              onMouseEnter={() => setHovered(pick.sleeperId)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        }}
      />
    </ProfileSection>
  );
}
