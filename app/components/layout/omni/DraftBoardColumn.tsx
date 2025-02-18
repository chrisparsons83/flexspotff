import type { OmniPlayer } from '@prisma/client';
import type { OmniDraftPick } from '~/models/omnipick.server';
import type { OmniUserTeam } from '~/models/omniuserteam.server';
import type { User } from '~/models/user.server';

type DraftBoardColumnProps = {
  omniTeam: OmniUserTeam & {
    user: User | null;
    draftPicks: (OmniDraftPick & {
      player: OmniPlayer | null;
    })[];
  };
};

const DraftBoardColumn = ({ omniTeam }: DraftBoardColumnProps) => {
  return (
    <div className='text-xs flex flex-col gap-1 text-center '>
      <div className='h-16 bg-slate-800 p-1 break-all'>
        {omniTeam.user?.discordName}
      </div>
      {omniTeam.draftPicks.map(draftPick => (
        <div key={draftPick.id} className='h-10 p-1 bg-slate-600'>
          {draftPick.player?.displayName}
        </div>
      ))}
    </div>
  );
};

export default DraftBoardColumn;
