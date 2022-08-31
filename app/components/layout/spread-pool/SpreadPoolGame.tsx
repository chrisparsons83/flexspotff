import clsx from "clsx";
import { useState } from "react";

import type { NFLTeam } from "~/models/nflteam.server";
import type {
  Bet,
  PoolGameByYearAndWeekElement,
} from "~/models/poolgame.server";

const formatSpread = (amount: number, home: boolean) => {
  if (amount === 0) return `Even`;
  const displayAmount = home ? amount : -1 * amount;
  const prefix = displayAmount > 0 ? "+" : "";
  return `${prefix}${displayAmount}`;
};

type Props = {
  handleChange: (bet: Bet[]) => void;
  poolGame: PoolGameByYearAndWeekElement;
  existingBet?: Bet;
};

export default function SpreadPoolGameComponent({
  handleChange,
  poolGame,
  existingBet,
}: Props) {
  const existingBetTeam =
    [poolGame.game.homeTeam, poolGame.game.awayTeam].find(
      (team) => team.id === existingBet?.teamId
    ) || null;
  const [betTeam, setBetTeam] = useState<NFLTeam | null>(existingBetTeam);
  const [betAmount, setBetAmount] = useState(
    Math.abs(existingBet?.amount || 0)
  );

  const betDisplay =
    betAmount !== 0 ? `${betAmount} on ${betTeam?.mascot}` : "No Bet";
  const betSliderDefault = !existingBet
    ? 0
    : existingBet.teamId === poolGame.game.awayTeamId
    ? -1 * existingBet.amount
    : existingBet.amount;

  const onBetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (+e.target.value > 0) {
      setBetTeam(poolGame.game.homeTeam);
      setBetAmount(+e.target.value);
      handleChange([
        { teamId: poolGame.game.homeTeam.id, amount: +e.target.value },
      ]);
    } else if (+e.target.value < 0) {
      setBetTeam(poolGame.game.awayTeam);
      setBetAmount(-1 * +e.target.value);
      handleChange([
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

  return (
    <div className={clsx("p-4", betAmount !== 0 && "bg-slate-800")}>
      <div className="flex gap-2 justify-between">
        <div className="w-2/5">
          {poolGame.game.awayTeam.mascot} (
          {formatSpread(poolGame.homeSpread, false)})
        </div>
        <div className="text-center">vs.</div>
        <div className="w-2/5 text-right">
          {poolGame.game.homeTeam.mascot} (
          {formatSpread(poolGame.homeSpread, true)})
        </div>
      </div>
      <input
        type="range"
        min="-50"
        max="50"
        step="10"
        name={`${poolGame.id}-${betTeam?.id}`}
        defaultValue={betSliderDefault}
        className="w-full"
        onChange={onBetChange}
      />
      <div>Current Bet: {betDisplay}</div>
    </div>
  );
}
