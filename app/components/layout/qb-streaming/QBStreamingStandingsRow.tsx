import type { LeaderboardEntry } from '~/components/layout/leaderboard/LeaderboardTable';
import MemberName from '~/components/ui/MemberName';
import { ProfileLink } from '~/components/ui/profile-link';

type Pick = {
  standardPlayer: {
    nflGame: { gameStartTime: Date };
    player: { fullName: string };
  };
  deepPlayer: {
    nflGame: { gameStartTime: Date };
    player: { fullName: string };
  };
};

/** A pick shows once its game has kicked off. */
const shown = (pick: Pick | undefined, side: 'standardPlayer' | 'deepPlayer') =>
  !pick
    ? 'No pick'
    : pick[side].nflGame.gameStartTime < new Date()
    ? pick[side].player.fullName
    : 'Pending';

/**
 * A QB streaming standings row: rank, member and points, opening to the week's
 * two picks once their games have kicked off.
 */
export function qbStreamingStandingsEntry({
  rank,
  user,
  pointsScored,
  pick,
}: {
  rank?: number;
  user: {
    userId: string;
    discordName: string;
    discordUsername?: string | null;
  };
  pointsScored: number;
  pick?: Pick;
}): LeaderboardEntry {
  return {
    id: user.userId,
    rank: rank ?? 0,
    name: (
      <ProfileLink userId={user.userId}>
        <MemberName user={user} />
      </ProfileLink>
    ),
    values: [pointsScored.toFixed(2)],
    details: (
      <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1'>
        <dt className='text-muted-foreground'>Standard</dt>
        <dd>{shown(pick, 'standardPlayer')}</dd>
        <dt className='text-muted-foreground'>Deep</dt>
        <dd>{shown(pick, 'deepPlayer')}</dd>
      </dl>
    ),
  };
}
