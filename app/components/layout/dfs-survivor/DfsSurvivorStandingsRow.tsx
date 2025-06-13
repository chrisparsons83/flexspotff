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
  showFlexAsActualPosition?: boolean;
};

const positionTypeOrder = {
  'QB': 1,
  'RB': 2,
  'WR': 3,
  'TE': 4,
  'FLEX': 5,
  'K': 6,
  'D/ST': 7,
};

const formatPosition = (rosterPosition: string, playerPosition?: string, showFlexAsActualPosition: boolean = true) => {
  // Remove numbers from QB, RB, WR, and FLEX positions
  const cleanPosition = rosterPosition.replace(/[12]$/, '');
  
  // If it's a FLEX position and we want to show actual position, return the player's actual position
  if (cleanPosition === 'FLEX' && showFlexAsActualPosition && playerPosition) {
    return playerPosition;
  }
  
  return cleanPosition;
};

const getPositionType = (position: string, showFlexAsActualPosition: boolean = true) => {
  const formattedPosition = formatPosition(position);
  
  // If we're not showing FLEX as actual position (weekly standings), keep FLEX as FLEX
  if (formattedPosition === 'FLEX' && !showFlexAsActualPosition) {
    return 'FLEX';
  }
  
  // Map FLEX positions to their actual player position (for overall standings)
  if (formattedPosition === 'FLEX') {
    // For FLEX positions, we need to use the player's actual position
    return 'FLEX'; // This will be handled separately
  }
  
  return formattedPosition;
};

const formatPoints = (points: number) => {
  return points.toFixed(2);
};

export default function DfsSurvivorStandingsRow({
  rank,
  user,
  points,
  entries,
  showFlexAsActualPosition = true,
}: Props) {
  const [showDetails, setShowDetails] = useState(false);

  const handleAccordion = () => {
    setShowDetails(prevState => !prevState);
  };

  if (!user) return null;

  // Sort entries by position type first, then by points within each position
  const sortedEntries = [...entries].sort((a, b) => {
    let positionTypeA = getPositionType(a.position, showFlexAsActualPosition);
    let positionTypeB = getPositionType(b.position, showFlexAsActualPosition);
    
    // For FLEX positions in overall standings, use the actual player position
    if (positionTypeA === 'FLEX' && showFlexAsActualPosition) {
      positionTypeA = a.player.position;
    }
    if (positionTypeB === 'FLEX' && showFlexAsActualPosition) {
      positionTypeB = b.player.position;
    }
    
    // First sort by position type
    const positionOrderA = positionTypeOrder[positionTypeA as keyof typeof positionTypeOrder] || 999;
    const positionOrderB = positionTypeOrder[positionTypeB as keyof typeof positionTypeOrder] || 999;
    
    if (positionOrderA !== positionOrderB) {
      return positionOrderA - positionOrderB;
    }
    
    // If same position type, sort by points (highest first)
    return b.points - a.points;
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
              {sortedEntries.map(entry => (
                <div key={entry.id} className="contents">
                  <div>{formatPosition(entry.position, entry.player.position, showFlexAsActualPosition)}</div>
                  <div>{entry.player.fullName}</div>
                  <div>{formatPoints(entry.points)}</div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
} 