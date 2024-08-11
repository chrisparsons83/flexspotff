import clsx from "clsx";
import { useState } from "react";

import type {
  LocksGameByYearAndWeekElement,
  TeamPick,
} from "~/models/locksgame.server";
import type { LocksGamePick } from "~/models/locksgamepicks.server";
import type { NFLTeam } from "~/models/nflteam.server";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

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
  const [pickedTeam, setPickedTeam] = useState<NFLTeam | null>(
    existingTeamPick
  );

  const defaultTabValue = existingTeamPick === locksGame.game.homeTeam ? "homeTeamPick" : existingTeamPick === locksGame.game.awayTeam ? "awayTeamPick" : "noTeamPick";

  const [isBetActive, setIsBetActive] = useState(
    existingLocksGamePick?.isActive
  );

  const gameDateTime = locksGame.game.gameStartTime;
  const now = new Date();
  const pickLocked = gameDateTime && gameDateTime < now;

  const wonGame = existingLocksGamePick && existingLocksGamePick.isWin;

  const lostGame = existingLocksGamePick && existingLocksGamePick.isLoss;

  const handleTabTriggerPress = (value: string) => {
    if (value === "homeTeamPick") {
      setPickedTeam(locksGame.game.homeTeam);
      handleChange([
        { teamId: locksGame.game.homeTeam.id, isActive: 1 },
        { teamId: locksGame.game.awayTeam.id, isActive: 0 },
      ]);
      setIsBetActive(1);
    } else if (value === "awayTeamPick") {
      setPickedTeam(locksGame.game.awayTeam);
      handleChange([
        { teamId: locksGame.game.awayTeam.id, isActive: 1 },
        { teamId: locksGame.game.homeTeam.id, isActive: 0 },
      ]);
      setIsBetActive(1);
    } else if (value === "noTeamPick") {
      setPickedTeam(null);
      handleChange([
        { teamId: locksGame.game.homeTeam.id, isActive: 0 },
        { teamId: locksGame.game.awayTeam.id, isActive: 0 },
      ]);
      setIsBetActive(0);
    }
  };

  return (
    <div
      className={clsx(
        "p-0",
        //betAmount !== 0 && "bg-slate-800",
        wonGame && "bg-green-900",
        lostGame && "bg-red-900"
      )}
    >
      <input type="hidden" name={`${locksGame.id}-${pickedTeam?.id}`} value={pickedTeam?.id ? 1 : 0} />
      <div className="mt-4 bg-slate-800 rounded-md">
        <Tabs defaultValue={defaultTabValue}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger
              value="awayTeamPick"
              onClick={() => handleTabTriggerPress("awayTeamPick")}
            >
              {locksGame.game.awayTeam.mascot}
            </TabsTrigger>
            <TabsTrigger
              value="noTeamPick"
              onClick={() => handleTabTriggerPress("noTeamPick")}
            >
              No Pick
            </TabsTrigger>
            <TabsTrigger
              value="homeTeamPick"
              onClick={() => handleTabTriggerPress("homeTeamPick")}
            >
              {locksGame.game.homeTeam.mascot}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
