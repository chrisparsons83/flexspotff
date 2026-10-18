import type { DFSSurvivorUserEntry, User } from '@prisma/client';
import type { LeaderboardEntry } from '~/components/layout/leaderboard/LeaderboardTable';
import MemberName from '~/components/ui/MemberName';
import { ProfileLink } from '~/components/ui/profile-link';
import { Table } from '~/components/ui/table';

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
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  FLEX: 5,
  K: 6,
  'D/ST': 7,
};

const formatPosition = (
  rosterPosition: string,
  playerPosition?: string,
  showFlexAsActualPosition: boolean = true,
) => {
  // Remove numbers from QB, RB, WR, and FLEX positions
  const cleanPosition = rosterPosition.replace(/[12]$/, '');

  // If it's a FLEX position and we want to show actual position, return the player's actual position
  if (cleanPosition === 'FLEX' && showFlexAsActualPosition && playerPosition) {
    return playerPosition;
  }

  return cleanPosition;
};

const getPositionType = (
  position: string,
  showFlexAsActualPosition: boolean = true,
) => {
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

/**
 * A DFS survivor standings row: rank, member and points, opening to the
 * lineup behind them, by position and then points.
 */
export function dfsSurvivorStandingsEntry({
  rank,
  user,
  points,
  entries,
  showFlexAsActualPosition = true,
}: Props & { user: User }): LeaderboardEntry {
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

    const positionOrderA =
      positionTypeOrder[positionTypeA as keyof typeof positionTypeOrder] || 999;
    const positionOrderB =
      positionTypeOrder[positionTypeB as keyof typeof positionTypeOrder] || 999;

    if (positionOrderA !== positionOrderB) {
      return positionOrderA - positionOrderB;
    }

    // If same position type, sort by points (highest first)
    return b.points - a.points;
  });

  return {
    id: user.id,
    rank: rank ?? 0,
    name: (
      <ProfileLink userId={user.id}>
        <MemberName user={user} />
      </ProfileLink>
    ),
    values: [formatPoints(points)],
    details:
      sortedEntries.length === 0 ? (
        <p className='text-muted-foreground'>No entries.</p>
      ) : (
        <Table headers={['Slot', 'Player', 'Points']} numericColumns={[2]}>
          {sortedEntries.map(entry => (
            <tr key={entry.id}>
              <td>
                {formatPosition(
                  entry.position,
                  entry.player.position,
                  showFlexAsActualPosition,
                )}
              </td>
              <td>{entry.player.fullName}</td>
              <td className='text-right'>{formatPoints(entry.points)}</td>
            </tr>
          ))}
        </Table>
      ),
  };
}
