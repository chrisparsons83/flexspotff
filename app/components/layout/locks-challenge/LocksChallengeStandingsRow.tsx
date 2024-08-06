import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/outline";
import clsx from "clsx";
import { useState } from "react";

import type {
    LocksGamePicksWonLoss,
    getLocksGamesPicksByLocksWeek,
} from "~/models/locksgamepicks.server";
import type { User } from "~/models/user.server";

type Props = {
  rank: number | undefined;
  user?: User;
  points?: number;
  locksChallengeWonLoss: LocksGamePicksWonLoss;
  picksLocked?: Awaited<ReturnType<typeof getLocksGamesPicksByLocksWeek>>;
};

export default function LocksChallengeStandingsRow({
  rank,
  user,
  points,
  locksChallengeWonLoss,
  picksLocked,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const handleAccordion = () => {
    setShowDetails((prevState) => !prevState);
  };

  if (!user) return null;

  const wins = locksChallengeWonLoss._sum?.isWin || 0;
  const losses = locksChallengeWonLoss._sum?.isLoss || 0;
  const ties = locksChallengeWonLoss._sum?.isTie || 0;

  const wlPercentage = (locksChallengeWonLoss._sum &&
                          (wins > 0 || losses > 0 || ties > 0))
    ? `${(
        ((wins) / (wins + losses + ties)) * 100
      ).toFixed(2)}%`
    : "No bets";

  return (
    <>
      <tr>
        <td>{rank}</td>
        <td className="flex items-center gap-3">
          {user.discordName}{" "}
          {showDetails ? (
            <ChevronUpIcon
              width={20}
              height={20}
              onClick={handleAccordion}
              className="cursor-pointer"
              aria-label="Hide Details"
            />
          ) : (
            <ChevronDownIcon
              width={20}
              height={20}
              onClick={handleAccordion}
              className="cursor-pointer"
              aria-label="Show Details"
            />
          )}
        </td>
        <td>{points}</td>
        <td>
          {locksChallengeWonLoss._sum.isWin}-{locksChallengeWonLoss._sum.isLoss}-
          {locksChallengeWonLoss._sum.isTie}
        </td>
        <td>{wlPercentage}</td>
      </tr>
      {showDetails && (
        <tr className="border-b-1 bg-gray-800">
          <td></td>
          <td>
            {picksLocked && picksLocked.length === 0 && (
              <div>No locked bets</div>
            )}
            {picksLocked &&
              picksLocked.map((pick) => {

                const resultAction =
                  pick.isWin === 1
                    ? "Won"
                    : pick.isLoss === 1
                    ? "Lost"
                    : pick.isTie === 1
                    ? "Pushed"
                    : "Bet";

                return (
                  <div
                    key={pick.id}
                    className={clsx(
                      "mb-1 border-l-8 pl-4 border-gray-500",
                      pick.isWin === 1 && "border-emerald-500",
                      pick.isLoss === 1 && "border-red-500"
                    )}
                  >
                    {resultAction} on {pick.teamBet.mascot}{" "}
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
