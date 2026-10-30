import { useState } from 'react';
import { Button } from '~/components/ui/button';
import type { NFLTeam } from '~/models/nflteam.server';
import type {
  Bet,
  PoolGameByYearAndWeekElement,
} from '~/models/poolgame.server';
import type { PoolGamePick } from '~/models/poolgamepicks.server';
import { cn } from '~/utils';

const formatSpread = (amount: number, home: boolean) => {
  if (amount === 0) return 'even';
  const displayAmount = home ? amount : -1 * amount;
  const prefix = displayAmount > 0 ? '+' : '';
  return `${prefix}${displayAmount}`;
};

type Props = {
  handleChange: (bet: Bet[]) => void;
  poolGame: PoolGameByYearAndWeekElement;
  existingBet?: Bet;
  existingPoolGamePick?: PoolGamePick;
};

export default function SpreadPoolGameComponent({
  handleChange,
  poolGame,
  existingBet,
  existingPoolGamePick,
}: Props) {
  const existingBetTeam =
    [poolGame.game.homeTeam, poolGame.game.awayTeam].find(
      team => team.id === existingBet?.teamId,
    ) || null;
  const [betTeam, setBetTeam] = useState<NFLTeam | null>(existingBetTeam);
  const [betAmount, setBetAmount] = useState(
    Math.abs(existingBet?.amount || 0),
  );
  const [showSlider, setShowSlider] = useState(
    Math.abs(existingBet?.amount || 0) > 0,
  );
  const [isBetReset, setIsBetReset] = useState(false);

  const betDisplay =
    betAmount !== 0 ? `${betAmount} on ${betTeam?.mascot}` : 'no bet';
  const betSliderDefault = !existingBet
    ? 0
    : existingBet.teamId === poolGame.game.awayTeamId
    ? -1 * existingBet.amount
    : existingBet.amount;

  const gameDateTime = poolGame.game.gameStartTime;
  const now = new Date();
  const pickLocked = gameDateTime && gameDateTime < now;

  const wonGame =
    existingPoolGamePick &&
    existingPoolGamePick.resultWonLoss &&
    existingPoolGamePick.resultWonLoss > 0;
  const lostGame =
    existingPoolGamePick &&
    existingPoolGamePick.resultWonLoss &&
    existingPoolGamePick.resultWonLoss < 0;

  const onBetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (+e.target.value > 0) {
      setIsBetReset(false);
      setBetTeam(poolGame.game.homeTeam);
      setBetAmount(+e.target.value);
      handleChange([
        { teamId: poolGame.game.homeTeam.id, amount: +e.target.value },
        { teamId: poolGame.game.awayTeam.id, amount: 0 },
      ]);
    } else if (+e.target.value < 0) {
      setIsBetReset(false);
      setBetTeam(poolGame.game.awayTeam);
      setBetAmount(-1 * +e.target.value);
      handleChange([
        { teamId: poolGame.game.homeTeam.id, amount: 0 },
        { teamId: poolGame.game.awayTeam.id, amount: -1 * +e.target.value },
      ]);
    } else {
      setBetTeam(null);
      setBetAmount(0);
      handleChange([
        { teamId: poolGame.game.homeTeam.id, amount: 0 },
        { teamId: poolGame.game.awayTeam.id, amount: 0 },
      ]);
    }
  };

  const displayBetInput = () => {
    setShowSlider(true);
  };

  const resetBet = () => {
    setBetTeam(existingBetTeam);
    setIsBetReset(true);
    setBetAmount(0);
    handleChange([
      { teamId: poolGame.game.homeTeam.id, amount: 0 },
      { teamId: poolGame.game.awayTeam.id, amount: 0 },
    ]);
    setShowSlider(false);
  };

  return (
    <div
      className={cn(
        'grid gap-4 bg-card p-5',
        betAmount !== 0 && 'bg-secondary',
        wonGame && 'bg-positive/20',
        lostGame && 'bg-destructive/20',
      )}
    >
      <div className='grid grid-cols-[1fr_auto_1fr] items-baseline gap-2'>
        <div>
          <span className='font-semibold'>{poolGame.game.awayTeam.mascot}</span>{' '}
          <span className='tabular-nums text-muted-foreground'>
            {formatSpread(poolGame.homeSpread, false)}
          </span>
        </div>
        <div className='text-muted-foreground'>at</div>
        <div className='text-right'>
          <span className='font-semibold'>{poolGame.game.homeTeam.mascot}</span>{' '}
          <span className='tabular-nums text-muted-foreground'>
            {formatSpread(poolGame.homeSpread, true)}
          </span>
        </div>
      </div>
      {isBetReset && (
        <input
          type='hidden'
          name={`${poolGame.id}-${existingBetTeam?.id}`}
          defaultValue={0}
        />
      )}
      {showSlider ? (
        <>
          <input
            type='range'
            min='-50'
            max='50'
            step='10'
            name={`${poolGame.id}-${betTeam?.id}`}
            defaultValue={betSliderDefault}
            className='w-full accent-[oklch(var(--primary))]'
            aria-label={`Bet on ${poolGame.game.awayTeam.mascot} at ${poolGame.game.homeTeam.mascot}`}
            onChange={onBetChange}
            disabled={pickLocked}
          />
          <div className='flex items-center justify-between gap-4'>
            <div>Current bet: {betDisplay}</div>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={resetBet}
              disabled={pickLocked}
            >
              Reset Bet
            </Button>
          </div>
        </>
      ) : (
        <Button
          type='button'
          variant='secondary'
          className='w-full'
          onClick={displayBetInput}
          disabled={pickLocked}
        >
          {betAmount !== 0 ? 'Bet Placed on Game' : 'Place Bet on Game'}
        </Button>
      )}
    </div>
  );
}
