import clsx from "clsx";
import { useState } from "react";

import type { NFLTeam } from "~/models/nflteam.server";
import type { 
    TeamPick, 
    LocksGameByYearAndWeekElement } from "~/models/locksgame.server";
import type { LocksGamePick } from "~/models/locksgamepicks.server";

import Button from "~/components/ui/Button";
import { Team } from "@prisma/client";

// const formatSpread = (amount: number, home: boolean) => {
//   if (amount === 0) return `Even`;
//   const displayAmount = home ? amount : -1 * amount;
//   const prefix = displayAmount > 0 ? "+" : "";
//   return `${prefix}${displayAmount}`;
// };

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
      (team) => team.id === existingPick?.teamId
    ) || null;
  const [pickedTeam, setPickedTeam] = useState<NFLTeam | null>(existingTeamPick);
//   const [betAmount, setBetAmount] = useState(
//     Math.abs(existingBet?.amount || 0)
//   );
  const [showSlider, setShowSlider] = useState(false);

  const pickedTeamDisplay =
  existingPick?.teamId !== null ? `${pickedTeam?.mascot}` : "No Selection";
  const pickSliderDefault = !existingPick
    ? 0
    : existingPick.teamId === locksGame.game.awayTeamId
    ? -1
    : 1;

  const gameDateTime = locksGame.game.gameStartTime;
  const now = new Date();
  const pickLocked = gameDateTime && gameDateTime < now;

  const wonGame =
    existingLocksGamePick &&
    existingLocksGamePick.isWin;

  const lostGame =
    existingLocksGamePick &&
    existingLocksGamePick.isLoss;

  const onPickChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (+e.target.value > 0) {
      setPickedTeam(locksGame.game.homeTeam);
      handleChange([
        { teamId: locksGame.game.homeTeam.id },
      ]);
    } else if (+e.target.value < 0) {
      setPickedTeam(locksGame.game.awayTeam);
      handleChange([
        { teamId: locksGame.game.awayTeam.id },
      ]);
    } else {
      setPickedTeam(null);
      handleChange([
        { teamId: locksGame.game.homeTeam.id },
        { teamId: locksGame.game.awayTeam.id },
      ]);
    }
  };

  const displayPickInput = () => {
    setShowSlider(true);
  };

  const resetPick = () => {
    setPickedTeam(null);
    handleChange([
        { teamId: locksGame.game.homeTeam.id },
        { teamId: locksGame.game.awayTeam.id },
      ]);
    setShowSlider(false);
  };

  return (
    <div
      className={clsx(
        "p-4",
        //betAmount !== 0 && "bg-slate-800",
        wonGame && "bg-green-900",
        lostGame && "bg-red-900"
      )}
    >
      <div className="flex gap-2 justify-between">
        <div className="w-2/5">
          {locksGame.game.awayTeam.mascot}
        </div>
        <div className="text-center">vs.</div>
        <div className="w-2/5 text-right">
          {locksGame.game.homeTeam.mascot}
        </div>
      </div>
      {showSlider && (
        <>
          <input
            type="range"
            min="-50"
            max="50"
            step="10"
            name={`${locksGame.id}-${pickedTeam?.id}`}
            defaultValue={pickSliderDefault}
            className="w-full"
            onChange={onPickChange}
            disabled={pickLocked}
          />
          <div className="flex justify-between">
            <div>Current Bet: {pickedTeamDisplay}</div>
            <div>
              <Button type="button" onClick={resetPick} disabled={pickLocked}>
                Reset Bet
              </Button>
            </div>
          </div>
        </>
      )}
      {!showSlider && (
        <div className="text-center">
          <Button type="button" className="w-full" onClick={displayPickInput}>
            {existingLocksGamePick?.teamBetId !== null ? "Team has been picked" : "No team selected"}
          </Button>
        </div>
      )}
    </div>
  );
}
