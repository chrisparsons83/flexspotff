import MemberAvatar from '~/components/ui/MemberAvatar';
import MemberName from '~/components/ui/MemberName';
import { DraftBoard, DraftBoardCell } from '~/components/ui/draft-board';
import type { DraftBoardColumnProps } from '~/models/omniseason.server';

type OmniTeam = DraftBoardColumnProps['omniTeam'];

const getBackgroundColor = (points: number, isComplete: boolean) => {
  if (points === 80) return 'bg-positive/60';
  if (points >= 50) return 'bg-positive/40';
  if (points >= 30) return 'bg-positive/25';
  if (points > 0) return 'bg-positive/15';
  if (isComplete) return 'bg-destructive/30';
  return 'bg-secondary';
};

/** The Omni draft, a column per team. Teams' picks are expected in order. */
export default function OmniDraftBoard({ teams }: { teams: OmniTeam[] }) {
  return (
    <DraftBoard
      columns={teams}
      rounds={Math.max(0, ...teams.map(team => team.draftPicks.length))}
      columnKey={team => team.id}
      renderHeader={team => <TeamHeader team={team} />}
      renderCell={(team, round) => {
        const draftPick = team.draftPicks[round - 1];
        if (!draftPick) return null;
        return (
          <DraftBoardCell
            title={draftPick.player?.displayName}
            subtitle={draftPick.player?.sport.shortName}
            corner={draftPick.pickNumber}
            tone={getBackgroundColor(
              draftPick.player?.pointsScored || 0,
              draftPick.player?.isComplete || false,
            )}
          />
        );
      }}
    />
  );
}

function TeamHeader({ team }: { team: OmniTeam }) {
  return (
    <div className='flex h-16 flex-col justify-between bg-secondary p-1 text-secondary-foreground'>
      {team.user ? (
        <MemberAvatar user={team.user} size={32} className='mx-auto' />
      ) : (
        <div className='mx-auto size-8 bg-muted' />
      )}
      <div className='line-clamp-1 w-full text-center'>
        {team.user && <MemberName user={team.user} />}
      </div>
    </div>
  );
}
