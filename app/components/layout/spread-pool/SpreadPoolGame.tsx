import clsx from 'clsx';
import { useState } from 'react';
import Button from '~/components/ui/Button';
import type { NFLTeam } from '~/models/nflteam.server';
import type {
  Bet,
  PoolGameByYearAndWeekElement,
} from '~/models/poolgame.server';
import type { PoolGamePick } from '~/models/poolgamepicks.server';

const formatSpread = (amount: number, home: boolean) => {
  if (amount === 0) return `Even`;
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
    betAmount !== 0 ? `${betAmount} on ${betTeam?.mascot}` : 'No Bet';
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
      className={clsx(
        'p-4',
        betAmount !== 0 && 'bg-slate-800',
        wonGame && 'bg-green-900',
        lostGame && 'bg-red-900',
      )}
    >
      <div className='flex gap-2 justify-between'>
        <div className='w-2/5'>
          {poolGame.game.awayTeam.mascot} (
          {formatSpread(poolGame.homeSpread, false)})
        </div>
        <div className='text-center'>vs.</div>
        <div className='w-2/5 text-right'>
          {poolGame.game.homeTeam.mascot} (
          {formatSpread(poolGame.homeSpread, true)})
        </div>
      </div>
      {isBetReset && (
        <input
          type='hidden'
          name={`${poolGame.id}-${existingBetTeam?.id}`}
          defaultValue={0}
        />
      )}
      {showSlider && (
        <>
          <input
            type='range'
            min='-50'
            max='50'
            step='10'
            name={`${poolGame.id}-${betTeam?.id}`}
            defaultValue={betSliderDefault}
            className='w-full'
            onChange={onBetChange}
            disabled={pickLocked}
          />
          <div className='flex justify-between'>
            <div>Current Bet: {betDisplay}</div>
            <div>
              <Button type='button' onClick={resetBet} disabled={pickLocked}>
                Reset Bet
              </Button>
            </div>
          </div>
        </>
      )}
      {!showSlider && (
        <div className='text-center'>
          <Button type='button' className='w-full' onClick={displayBetInput}>
            {betAmount !== 0 ? 'Bet placed on game' : 'Place bet on game'}
          </Button>
        </div>
      )}
    </div>
  );
}
