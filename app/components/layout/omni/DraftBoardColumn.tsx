import clsx from 'clsx';
import type { DraftBoardColumnProps } from '~/models/omniseason.server';

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
          className='h-8 w-8 mx-auto rounded-2xl'
          alt={omniTeam.user?.discordName}
        />
        <div className='text-center w-full line-clamp-1'>
          {omniTeam.user?.discordName}
        </div>
      </div>
      {omniTeam.draftPicks.map(draftPick => {
        return (
          <div
            key={draftPick.id}
            className={clsx(
              getBackgroundColor(
                draftPick.player?.pointsScored || 0,
                draftPick.player?.isComplete || false,
              ),
              'h-16 p-1 bg-slate-600 flex',
            )}
          >
            <div className='flex flex-col justify-between flex-4'>
              <div className='font-bold line-clamp-2'>
                {draftPick.player?.displayName}
              </div>
              <div className='line-clamp-1'>
                {draftPick.player?.sport.shortName}
              </div>
            </div>
            <div className='flex-1 text-right flex flex-col justify-between'>
              <div className='text-xs text-slate-500'>
                {draftPick.pickNumber}
              </div>
              <div className='text-2xl'>{draftPick.player?.sport.emoji}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DraftBoardColumn;
