import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/outline";
import { useState } from "react";

type Props = {
  rank?: number;
  discordName: string;
  pointsScored: number;
  standardPlayer: string;
  deepPlayer?: string;
};

export default function QBStreamingStandingsRowComponent({
  rank,
  discordName,
  pointsScored,
  standardPlayer,
  deepPlayer,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const handleAccordion = () => {
    setShowDetails((prevState) => !prevState);
  };

  return (
    <>
      <tr>
        <td>{rank}</td>
        <td className="flex items-center gap-3">
          {discordName}{" "}
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
        <td>{pointsScored}</td>
      </tr>
      {showDetails && (
        <tr className="border-b-1 bg-gray-800">
          <td></td>
          <td>
            <div className="mb-1 border-l-8 pl-4 border-gray-500">
              Standard: {standardPlayer}
            </div>
            <div className="mb-1 border-l-8 pl-4 border-gray-500">
              Deep: {deepPlayer}
            </div>
          </td>
          <td></td>
        </tr>
      )}
    </>
  );
}
