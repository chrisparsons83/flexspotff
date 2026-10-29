import type { LoaderFunctionArgs } from '@remix-run/node';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import {
  DraftBoard,
  DraftBoardCell,
  DraftBoardHeader,
} from '~/components/ui/draft-board';
import { EmptyState } from '~/components/ui/empty-state';
import { positionTint } from '~/components/ui/fills';
import { Section } from '~/components/ui/section';
import { requireGuillotineAccess } from '~/libs/guillotine/access.server';
import { ordinal, teamName } from '~/libs/guillotine/display';
import {
  getGuillotineDraftPicks,
  getGuillotineLeagueForPage,
} from '~/models/guillotine.server';
import { getPlayersBySleepersIds } from '~/models/players.server';
import { cn } from '~/utils';
import { type RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  width: 'full',
  title: 'Draft',
};

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
          ? `${ordinal(team.finish ?? 0)}, week ${team.choppedWeek}`
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
    return <EmptyState title='The draft has not happened yet' />;
  }

  return (
    <Section title='Draft Board'>
      <DraftBoard
        columns={columns}
        rounds={rounds}
        columnKey={column => column.rosterId}
        renderHeader={column => (
          <DraftBoardHeader
            title={column.name}
            subtitle={
              <span
                className={cn(
                  column.fate === 'Champion' && 'font-semibold text-foreground',
                  column.fate === 'Alive' && 'text-positive',
                )}
              >
                {column.fate}
              </span>
            }
          />
        )}
        renderCell={(column, round) => {
          const pick = column.picks.find(p => p.round === round);
          if (!pick) return null;
          return (
            <DraftBoardCell
              title={shortName(pick)}
              subtitle={`${pick.position ?? '?'} ${pick.nflTeam ?? 'FA'}`}
              corner={pick.pickNo}
              tone={positionTint(pick.position)}
              tooltip={`${pick.fullName}, pick ${pick.pickNo} by ${column.name}`}
              highlighted={hovered === pick.sleeperId}
              dimmed={hovered !== null && hovered !== pick.sleeperId}
              onMouseEnter={() => setHovered(pick.sleeperId)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        }}
      />
    </Section>
  );
}
