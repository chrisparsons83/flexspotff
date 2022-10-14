import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/outline";
import clsx from "clsx";
import { useState } from "react";

import type { League } from "~/models/league.server";
import type { Player } from "~/models/players.server";
import type { Team } from "~/models/team.server";
import type { TeamGame } from "~/models/teamgame.server";
import type { User } from "~/models/user.server";

// TODO: Clean up this typing.
type Props = {
  position: TeamGame & {
    team: Team & {
      league: League;
      user: User | null;
    };
    startingPlayers: Player[];
  };
  rank: number;
};

export default function LeaderboardRow({ position, rank }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const handleAccordion = () => {
    setShowDetails((prevState) => !prevState);
  };

  // TODO: Export this from a single location, it gets used elsewhere.
  const rankColors: Record<string, string> = {
    admiral: "bg-admiral text-gray-900",
    champions: "bg-champions text-gray-900",
    dragon: "bg-dragon text-gray-900",
    galaxy: "bg-galaxy text-gray-900",
    monarch: "bg-monarch text-gray-900",
  };

  const positionColors: Record<string, string> = {
    qb: "border-qb",
    rb: "border-rb",
    wr: "border-wr",
    te: "border-te",
    def: "border-def",
    empty: "border-gray-500",
  };

  return (
    <>
      <tr
        key={position.teamId}
        className={clsx(rank % 2 === 0 ? "bg-gray-900" : "bg-gray-800", "p-2")}
      >
        <td className="pl-1">
          <div
            className={clsx(
              rankColors[position.team.league.name.toLocaleLowerCase()],
              "mx-auto w-8 h-8 flex justify-center items-center font-bold text-sm"
            )}
          >
            {rank}
          </div>
        </td>
        <td className="flex items-center gap-3">
          {position.team.user?.discordName || "Missing user"}{" "}
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
        <td>{position.pointsScored?.toFixed(2)}</td>
      </tr>
      {showDetails && (
        <tr className="border-b-1 bg-gray-800 ">
          <td colSpan={3}>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 px-4">
              {position.starters.map((starterId, index) => {
                const player = position.startingPlayers.find(
                  (starter) => starter.sleeperId === starterId
                );

                const playerPosition =
                  player?.position?.toLocaleLowerCase() || "empty";

                return (
                  <div
                    className={clsx(
                      positionColors[playerPosition],
                      "mb-1 border-l-8 pl-4"
                    )}
                    key={starterId}
                  >
                    <div className="flex items-baseline gap-2">
                      <div>{player?.fullName || "Empty"}</div>
                      <div className="text-sm italic text-gray-400">
                        {position.startingPlayerPoints[index].toFixed(2)} pts
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
