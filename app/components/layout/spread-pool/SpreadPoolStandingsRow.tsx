import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/outline';
import clsx from 'clsx';
import { useState } from 'react';

import type {
  PoolGamePicksWonLoss,
  getPoolGamesPicksByPoolWeek,
} from '~/models/poolgamepicks.server';
import type { User } from '~/models/user.server';

type Props = {
  rank: number | undefined;
  user?: User;
  poolGameWonLoss: PoolGamePicksWonLoss;
  initialBudget?: number;
  picksLocked?: Awaited<ReturnType<typeof getPoolGamesPicksByPoolWeek>>;
};

export default function SpreadPoolStandingsRow({
  rank,
  user,
  poolGameWonLoss,
  picksLocked,
  initialBudget = 1000,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const handleAccordion = () => {
    setShowDetails(prevState => !prevState);
  };

  if (!user) return null;

  const returnOnEquity = poolGameWonLoss._sum.amountBet
    ? `${(
        ((poolGameWonLoss._sum.resultWonLoss || 0) /
          (poolGameWonLoss._sum.amountBet || 1)) *
        100
      ).toFixed(2)}%`
    : 'No bets';

  return (
    <>
      <tr>
        <td>{rank}</td>
        <td className='flex items-center gap-3'>
          {user.discordName}{' '}
          {showDetails ? (
            <ChevronUpIcon
              width={20}
              height={20}
              onClick={handleAccordion}
              className='cursor-pointer'
              aria-label='Hide Details'
            />
          ) : (
            <ChevronDownIcon
              width={20}
              height={20}
              onClick={handleAccordion}
              className='cursor-pointer'
              aria-label='Show Details'
            />
          )}
        </td>
        <td>{initialBudget + (poolGameWonLoss._sum.resultWonLoss || 0)}</td>
        <td>
          {poolGameWonLoss._sum.isWin}-{poolGameWonLoss._sum.isLoss}-
          {poolGameWonLoss._sum.isTie}
        </td>
        <td>{returnOnEquity}</td>
      </tr>
      {showDetails && (
        <tr className='border-b-1 bg-gray-800'>
          <td></td>
          <td>
            {picksLocked && picksLocked.length === 0 && (
              <div>No locked bets</div>
            )}
            {picksLocked &&
              picksLocked.map(pick => {
                const spreadAmount =
                  pick.teamBetId === pick.poolGame.game.homeTeamId
                    ? pick.poolGame.homeSpread
                    : -1 * pick.poolGame.homeSpread;

                const spreadDisplay =
                  spreadAmount === 0
                    ? 'Even'
                    : spreadAmount > 0
                      ? `+${spreadAmount}`
                      : `${spreadAmount}`;

                const resultAction =
                  pick.resultWonLoss! > 0
                    ? 'Won'
                    : pick.resultWonLoss! < 0
                      ? 'Lost'
                      : pick.isScored
                        ? 'Pushed'
                        : 'Bet';

                return (
                  <div
                    key={pick.id}
                    className={clsx(
                      'mb-1 border-l-8 pl-4 border-gray-500',
                      pick.resultWonLoss! > 0 && 'border-green-500',
                      pick.resultWonLoss! < 0 && 'border-red-500',
                    )}
                  >
                    {resultAction} {pick.amountBet} on {pick.teamBet.mascot}{' '}
                    {spreadDisplay}
                  </div>
                );
              })}
          </td>
          <td></td>
          <td></td>
        </tr>
      )}
    </>
  );
}
