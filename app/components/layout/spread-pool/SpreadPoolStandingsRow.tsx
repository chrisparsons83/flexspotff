import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/outline";
import { useState } from "react";

import type {
  PoolGamePicksWonLoss,
  getPoolGamesPicksByPoolWeek,
} from "~/models/poolgamepicks.server";
import type { User } from "~/models/user.server";

type Props = {
  rank: number;
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
    setShowDetails((prevState) => !prevState);
  };

  if (!user) return null;

  return (
    <>
      <tr key={user.id}>
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
        <td>{initialBudget + (poolGameWonLoss._sum.resultWonLoss || 0)}</td>
      </tr>
      {showDetails && (
        <tr className="border-b-1 bg-gray-800">
          <td></td>
          <td>
            {picksLocked && picksLocked.length === 0 && (
              <div>No locked bets</div>
            )}
            {picksLocked &&
              picksLocked.map((pick) => (
                <div
                  key={pick.id}
                  className="mb-1 border-l-8 pl-4 border-gray-500"
                >
                  Bet {pick.amountBet} on {pick.teamBet.mascot}
                </div>
              ))}
          </td>
          <td></td>
        </tr>
      )}
    </>
  );
}
