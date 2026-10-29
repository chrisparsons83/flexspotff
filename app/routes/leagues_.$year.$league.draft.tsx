import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import {
  DraftBoard,
  DraftBoardCell,
  DraftBoardHeader,
} from '~/components/ui/draft-board';
import { EmptyState } from '~/components/ui/empty-state';
import { positionTint } from '~/components/ui/fills';
import { Section } from '~/components/ui/section';
import { requireLeague } from '~/libs/leagues/page.server';
import { getDraftBoardPicks } from '~/models/draftpick.server';
import { type RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  width: 'full',
  title: 'Draft',
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const league = await requireLeague({ params, request });
  const picks = await getDraftBoardPicks(league.id);
  const teams = league.teams.length;

  const columns = league.teams
    .map(team => {
      const teamPicks = picks.filter(pick => pick.teamId === team.id);
      return {
        id: team.id,
        name: team.user?.discordName ?? 'Unclaimed team',
        // Older seasons have no draft position stored; the first pick says.
        slot: team.draftPosition ?? teamPicks[0]?.pickNumber ?? 99,
        picks: teamPicks.map(pick => ({
          id: pick.id,
          pickNumber: pick.pickNumber,
          // From the pick number, not the team's list: a traded pick leaves
          // a team with two picks in one round and none in another.
          round: Math.ceil(pick.pickNumber / teams),
          name: pick.Player.fullName,
          position: pick.Player.position,
          nflTeam: pick.Player.nflTeam,
        })),
      };
    })
    .sort((a, b) => a.slot - b.slot);

  return typedjson({
    columns,
    rounds: Math.max(
      0,
      ...picks.map(pick => Math.ceil(pick.pickNumber / teams)),
    ),
  });
};

export default function LeagueDraft() {
  const { columns, rounds } = useTypedLoaderData<typeof loader>();

  return (
    <Section title='Draft' description='One column per team in draft order.'>
      {rounds === 0 ? (
        <EmptyState title='The draft has not happened yet'>
          The board fills in once the league drafts.
        </EmptyState>
      ) : (
        <DraftBoard
          columns={columns}
          rounds={rounds}
          columnKey={column => column.id}
          renderHeader={column => <DraftBoardHeader title={column.name} />}
          renderCell={(column, round) => {
            const inRound = column.picks.filter(pick => pick.round === round);
            if (inRound.length === 0) return null;
            return (
              <div className='grid gap-1'>
                {inRound.map(pick => (
                  <DraftBoardCell
                    key={pick.id}
                    title={pick.name}
                    subtitle={[pick.position, pick.nflTeam ?? 'FA']
                      .filter(Boolean)
                      .join(' ')}
                    corner={pick.pickNumber}
                    tone={positionTint(pick.position)}
                  />
                ))}
              </div>
            );
          }}
        />
      )}
    </Section>
  );
}
