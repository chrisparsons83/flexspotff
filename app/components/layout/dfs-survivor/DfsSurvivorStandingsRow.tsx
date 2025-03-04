import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/outline';
import { useState } from 'react';
import type { DFSSurvivorUserEntry, User } from '@prisma/client';

type Props = {
  rank: number | undefined;
  user?: User;
  points: number;
  entries: (DFSSurvivorUserEntry & {
    player: {
      fullName: string;
      position: string;
    };
  })[];
};

const positionOrder = {
  'QB1': 1,
  'QB2': 2,
  'RB1': 3,
  'RB2': 4,
  'WR1': 5,
  'WR2': 6,
  'TE': 7,
  'FLEX1': 8,
  'FLEX2': 9,
  'K': 10,
  'D/ST': 11,
};

const formatPosition = (position: string) => {
  // Remove numbers from QB, RB, WR, and FLEX positions
  return position.replace(/[12]$/, '');
};

const formatPoints = (points: number) => {
  return points.toFixed(2);
};

export default function DfsSurvivorStandingsRow({
  rank,
  user,
  points,
  entries,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const handleAccordion = () => {
    setShowDetails(prevState => !prevState);
  };

  if (!user) return null;

  // Sort entries by position order
  const sortedEntries = [...entries].sort((a, b) => {
    const posA = a.id.split('-').pop() || '';
    const posB = b.id.split('-').pop() || '';
    return (positionOrder[posA as keyof typeof positionOrder] || 0) - 
           (positionOrder[posB as keyof typeof positionOrder] || 0);
  });

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
        <td>{formatPoints(points)}</td>
      </tr>
      {showDetails && (
        <tr className='border-b-1 bg-gray-800'>
          <td></td>
          <td colSpan={2}>
            {sortedEntries.length === 0 && <div>No entries</div>}
            <div className="grid grid-cols-3 gap-4">
              {sortedEntries.map(entry => {
                const position = entry.id.split('-').pop() || '';
                return (
                  <>
                    <div>{formatPosition(position)}</div>
                    <div>{entry.player.fullName}</div>
                    <div>{formatPoints(entry.points)}</div>
                  </>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
} 