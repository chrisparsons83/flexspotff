import DraftBoard, {
  DraftBoardCell,
} from '~/components/layout/draftboard/DraftBoard';
import type { DraftBoardColumnProps } from '~/models/omniseason.server';

type OmniTeam = DraftBoardColumnProps['omniTeam'];

const getBackgroundColor = (points: number, isComplete: boolean) => {
  if (points === 80) {
    return 'bg-green-600 bg-opacity-80';
  } else if (points >= 50) {
    return 'bg-green-600 bg-opacity-50';
  } else if (points >= 30) {
    return 'bg-green-600 bg-opacity-30';
  } else if (points > 0) {
    return 'bg-green-600 bg-opacity-20';
  } else if (isComplete) {
    return 'bg-red-600 bg-opacity-30';
  } else {
    return 'bg-slate-600';
  }
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
            trailing={
              <span className='text-2xl'>{draftPick.player?.sport.emoji}</span>
            }
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
  const avatarImage =
    team.user?.discordAvatar &&
    `https://cdn.discordapp.com/${team.user.discordAvatar}`;

  return (
    <div className='flex h-16 flex-col justify-between rounded bg-slate-800 p-1'>
      {avatarImage ? (
        <img
          src={avatarImage}
          className='mx-auto h-8 w-8 rounded-2xl'
          alt={team.user?.discordName}
        />
      ) : (
        <div className='mx-auto h-8 w-8 rounded-2xl bg-slate-700' />
      )}
      <div className='line-clamp-1 w-full text-center'>
        {team.user?.discordName}
      </div>
    </div>
  );
}
