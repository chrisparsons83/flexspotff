import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import type {
  LocksGameByYearAndWeekElement,
  TeamPick,
} from '~/models/locksgame.server';
import type { LocksGamePick } from '~/models/locksgamepicks.server';
import type { NFLTeam } from '~/models/nflteam.server';
import { cn } from '~/utils';

type Props = {
  handleChange: (teamPick: TeamPick[]) => void;
  locksGame: LocksGameByYearAndWeekElement;
  existingPick?: TeamPick;
  existingLocksGamePick?: LocksGamePick;
  weekLocked: boolean;
};

export default function LocksChallengeGameComponent({
  handleChange,
  locksGame,
  existingPick,
  existingLocksGamePick,
  weekLocked,
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

  // Lock the pick under any of these conditions: the game has started, the week
  // is scored, or the week's Sunday 1PM ET deadline has passed.
  const pickLocked =
    (gameDateTime && gameDateTime < now) || isWeekScored || weekLocked;

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
  const result = wonGame === 1 ? 'Won' : lostGame === 1 ? 'Lost' : null;
  const options = [
    { value: 'awayTeamPick', label: locksGame.game.awayTeam.mascot },
    { value: 'noTeamPick', label: 'No Pick' },
    { value: 'homeTeamPick', label: locksGame.game.homeTeam.mascot },
  ];

  return (
    <fieldset
      className={cn(
        'bg-card px-5 py-4',
        result === 'Won' && 'bg-positive/20',
        result === 'Lost' && 'bg-destructive/20',
      )}
    >
      <legend className='sr-only'>
        {locksGame.game.awayTeam.mascot} at {locksGame.game.homeTeam.mascot}
      </legend>
      <input
        type='hidden'
        name={`${locksGame.id}-${pickedTeam?.id}`}
        value={pickedTeam?.id ? 1 : 0}
      />
      <RadioGroup
        defaultValue={defaultTabValue}
        onValueChange={handleTabTriggerPress}
        disabled={pickLocked || false}
        className='grid-cols-3'
      >
        {options.map(option => (
          <label
            key={option.value}
            className={cn(
              'flex items-center gap-2',
              option.value === 'homeTeamPick' && 'justify-end',
              option.value === 'noTeamPick' &&
                'justify-center text-muted-foreground',
            )}
          >
            <RadioGroupItem value={option.value} />
            {option.label}
          </label>
        ))}
      </RadioGroup>
      {result && (
        <p
          className={cn(
            'mt-2 text-sm font-semibold',
            result === 'Won' ? 'text-positive' : 'text-negative',
          )}
        >
          {result}
        </p>
      )}
    </fieldset>
  );
}
