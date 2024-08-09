import clsx from "clsx";
import { useState, useRef } from "react";

import type { NFLTeam } from "~/models/nflteam.server";
import type { 
    TeamPick, 
    LocksGameByYearAndWeekElement } from "~/models/locksgame.server";
import type { LocksGamePick } from "~/models/locksgamepicks.server";

import Button from "~/components/ui/Button";

import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"

const formatSpread = (amount: number, home: boolean) => {
  if (amount === 0) return `Even`;
  const displayAmount = home ? amount : -1 * amount;
  const prefix = displayAmount > 0 ? "+" : "";
  return `${prefix}${displayAmount}`;
};

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
  const [showSlider, setShowSlider] = useState(false);
  const [isBetActive, setIsBetActive] = useState(existingLocksGamePick?.isActive);

  const pickSliderDefault = (!existingPick || !isBetActive)
    ? 0
    : existingPick.teamId === locksGame.game.awayTeamId
    ? -1
    : 1;

  const pickedTeamDisplay =
  (existingPick?.teamId !== null  && isBetActive) ? `${pickedTeam?.mascot}` : "No Selection";

  const gameDateTime = locksGame.game.gameStartTime;
  const now = new Date();
  const pickLocked = gameDateTime && gameDateTime < now;

  const wonGame =
    existingLocksGamePick &&
    existingLocksGamePick.isWin;

  const lostGame =
    existingLocksGamePick &&
    existingLocksGamePick.isLoss;

  const displayPickInput = () => {
    setShowSlider(true);
  };

  const handleTabTriggerPress = (value: string) => {

    if (value === "homeTeamPick") {
      setPickedTeam(locksGame.game.homeTeam);
      handleChange([
        { teamId: locksGame.game.homeTeam.id,
          isActive: 1
        },
        { teamId: locksGame.game.awayTeam.id,
          isActive: 0
        },
      ]);
      setIsBetActive(1);
    }
    else if (value === "awayTeamPick") {
      setPickedTeam(locksGame.game.awayTeam);
      handleChange([
        { teamId: locksGame.game.awayTeam.id,
          isActive: 1
        },
        { teamId: locksGame.game.homeTeam.id,
          isActive: 0
        },
      ]);
      setIsBetActive(1);
    }
    else if (value === "noTeamPick") {
      setPickedTeam(null);
      handleChange([
        { teamId: locksGame.game.homeTeam.id,
          isActive: 0
        },
        { teamId: locksGame.game.awayTeam.id,
          isActive: 0
        },
      ]);
      setIsBetActive(0);
    }
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
      {
        <>
          {
          <div className="mt-4">
            <Tabs defaultValue="noTeamPick">
              <TabsList className="flex justify-between">
                <TabsTrigger value="awayTeamPick" className={clsx("bg-slate-800 rounded-md py-2 px-4 text-white", pickedTeam === locksGame.game.awayTeam && "bg-blue-100 text-blue-900")} onClick={() => handleTabTriggerPress("awayTeamPick")}>{locksGame.game.awayTeam.mascot}</TabsTrigger>
                <TabsTrigger value="noTeamPick" className={clsx("bg-slate-800 rounded-md py-2 px-4 text-white", pickedTeam === null && "bg-blue-100 text-blue-900")} onClick={() => handleTabTriggerPress("noTeamPick")}>No Pick</TabsTrigger>
                <TabsTrigger value="homeTeamPick" className={clsx("bg-slate-800 rounded-md py-2 px-4 text-white", pickedTeam === locksGame.game.homeTeam && "bg-blue-100 text-blue-900")} onClick={() => handleTabTriggerPress("homeTeamPick")}>{locksGame.game.homeTeam.mascot}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          }
        </>
      }
    </div>
  );
}
