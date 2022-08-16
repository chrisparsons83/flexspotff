import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/outline";
import clsx from "clsx";
import { useState } from "react";
import type { currentResultsBase } from "~/models/fsquared.server";

type Props = {
  rank: number;
  result: currentResultsBase;
};

const isPending = (draftDate: Date | null) => {
  return !draftDate || draftDate > new Date();
};

export default function FSquaredStandingsRow({ rank, result }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const handleAccordion = () => {
    setShowDetails((prevState) => !prevState);
  };

  // We do this because tailwind HATES dynamic class names
  const borderColors: Record<string, string> = {
    admiral: "border-admiral",
    champions: "border-champions",
    dragon: "border-dragon",
    galaxy: "border-galaxy",
    monarch: "border-monarch",
  };

  return (
    <>
      <tr>
        <td>{rank}</td>
        <td className="flex items-center gap-3">
          {result.user.discordName}{" "}
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
        <td>{result.totalPoints}</td>
      </tr>
      {showDetails && (
        <tr className="border-b-1 bg-gray-800">
          <td></td>
          <td>
            <div className="grid grid-cols-2">
              {result.teams.map((team) => (
                <div
                  key={team.id}
                  className={clsx(
                    borderColors[team.league.name.toLowerCase()],
                    isPending(team.league.draftDateTime) &&
                      `italic text-gray-600`,
                    "mb-1 border-l-8 pl-4"
                  )}
                >
                  {isPending(team.league.draftDateTime)
                    ? `Pending`
                    : team.user?.discordName}
                </div>
              ))}
            </div>
          </td>
          <td></td>
        </tr>
      )}
    </>
  );
}
