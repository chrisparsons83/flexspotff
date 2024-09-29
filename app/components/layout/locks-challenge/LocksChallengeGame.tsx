import clsx from 'clsx';
import { DateTime } from 'luxon';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import type {
  LocksGameByYearAndWeekElement,
  TeamPick,
} from '~/models/locksgame.server';
import type { LocksGamePick } from '~/models/locksgamepicks.server';
import type { NFLTeam } from '~/models/nflteam.server';

type Props = {
  handleChange: (teamPick: TeamPick[]) => void;
  locksGame: LocksGameByYearAndWeekElement;
  existingPick?: TeamPick;
  existingLocksGamePick?: LocksGamePick;
};

export default function LocksChallengeGameComponent({
  handleChange,
  locksGame,
  existingPick,
  existingLocksGamePick,
}: Props) {
  const existingTeamPick =
    [locksGame.game.homeTeam, locksGame.game.awayTeam].find(
      team => team.id === existingPick?.teamId,
    ) || null;
  const [pickedTeam, setPickedTeam] = useState<NFLTeam | null>(
    existingTeamPick,
  );

  const defaultTabValue =
    existingTeamPick === locksGame.game.homeTeam
      ? 'homeTeamPick'
      : existingTeamPick === locksGame.game.awayTeam
      ? 'awayTeamPick'
      : 'noTeamPick';

  const gameDateTime = locksGame.game.gameStartTime;
  const now = new Date();
  const isWeekScored = existingLocksGamePick?.isScored;

  const nextSunday = DateTime.now()
    .setZone('America/New_York')
    .minus({ day: 1 })
    .set({ weekday: 7, hour: 13, minute: 0, second: 0 })
    .toJSDate();

  // Lock the pick under any of these consitions: the game has started, the week is scored, or the next Sunday at 1PM EST has passed
  const pickLocked =
    (gameDateTime && gameDateTime < now) ||
    isWeekScored ||
    (nextSunday && nextSunday < now);

  const wonGame = existingLocksGamePick && existingLocksGamePick.isWin;

  const lostGame = existingLocksGamePick && existingLocksGamePick.isLoss;

  const handleTabTriggerPress = (value: string) => {
    if (value === 'homeTeamPick') {
      setPickedTeam(locksGame.game.homeTeam);
      handleChange([
        { teamId: locksGame.game.homeTeam.id, isActive: 1 },
        { teamId: locksGame.game.awayTeam.id, isActive: 0 },
      ]);
    } else if (value === 'awayTeamPick') {
      setPickedTeam(locksGame.game.awayTeam);
      handleChange([
        { teamId: locksGame.game.awayTeam.id, isActive: 1 },
        { teamId: locksGame.game.homeTeam.id, isActive: 0 },
      ]);
    } else if (value === 'noTeamPick') {
      setPickedTeam(null);
      handleChange([
        { teamId: locksGame.game.homeTeam.id, isActive: 0 },
        { teamId: locksGame.game.awayTeam.id, isActive: 0 },
      ]);
    }
  };
  return (
    <div>
      <input
        type='hidden'
        name={`${locksGame.id}-${pickedTeam?.id}`}
        value={pickedTeam?.id ? 1 : 0}
      />
      <div className='mt-4 bg-slate-800 rounded-md'>
        <Tabs defaultValue={defaultTabValue}>
          <TabsList className={`grid w-full grid-cols-3`}>
            <TabsTrigger
              value='awayTeamPick'
              onClick={() => handleTabTriggerPress('awayTeamPick')}
              className={clsx({
                '!bg-green-900':
                  wonGame === 1 && defaultTabValue === 'awayTeamPick',
                '!bg-red-900':
                  lostGame === 1 && defaultTabValue === 'awayTeamPick',
              })}
              disabled={pickLocked || false}
            >
              {locksGame.game.awayTeam.mascot}
            </TabsTrigger>
            <TabsTrigger
              value='noTeamPick'
              onClick={() => handleTabTriggerPress('noTeamPick')}
              className={clsx({
                '!bg-green-900':
                  wonGame === 1 && defaultTabValue === 'noTeamPick',
                '!bg-red-900':
                  lostGame === 1 && defaultTabValue === 'noTeamPick',
              })}
              disabled={pickLocked || false}
            >
              No Pick
            </TabsTrigger>
            <TabsTrigger
              value='homeTeamPick'
              onClick={() => handleTabTriggerPress('homeTeamPick')}
              className={clsx({
                '!bg-green-900':
                  wonGame === 1 && defaultTabValue === 'homeTeamPick',
                '!bg-red-900':
                  lostGame === 1 && defaultTabValue === 'homeTeamPick',
              })}
              disabled={pickLocked || false}
            >
              {locksGame.game.homeTeam.mascot}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
