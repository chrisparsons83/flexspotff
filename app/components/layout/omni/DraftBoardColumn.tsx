import type { DraftBoardColumnProps } from '~/models/omniseason.server';

const DraftBoardColumn = ({ omniTeam }: DraftBoardColumnProps) => {
  const avatarImage =
    omniTeam.user &&
    omniTeam.user.discordAvatar &&
    `https://cdn.discordapp.com/${omniTeam.user.discordAvatar}`;

  return (
    <div className='text-xs flex flex-col gap-1 grow not-prose'>
      <div className='h-16 bg-slate-800 p-1 flex flex-col justify-between'>
        <img
          src={avatarImage!}
          className='h-8 w-8 mx-auto'
          alt={omniTeam.user?.discordName}
        />
        <div className='text-center w-full line-clamp-1'>
          {omniTeam.user?.discordName}
        </div>
      </div>
      {omniTeam.draftPicks.map(draftPick => (
        <div key={draftPick.id} className='h-16 p-1 bg-slate-600 flex'>
          <div className='flex flex-col justify-between flex-4'>
            <div className='font-bold line-clamp-2'>
              {draftPick.player?.displayName}
            </div>
            <div>{draftPick.player?.sport.shortName}</div>
          </div>
          <div className='flex-1 text-right text-2xl flex flex-col justify-end'>
            {draftPick.player?.sport.emoji}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DraftBoardColumn;
