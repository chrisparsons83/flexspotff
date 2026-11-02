import type { LeaderboardEntry } from '~/components/layout/leaderboard/LeaderboardTable';
import MemberName from '~/components/ui/MemberName';
import { ProfileLink } from '~/components/ui/profile-link';
import type {
  LocksGamePicksWonLoss,
  getLocksGamesPicksByLocksWeek,
} from '~/models/locksgamepicks.server';
import type { User } from '~/models/user.server';

export type LockedPicks = Awaited<
  ReturnType<typeof getLocksGamesPicksByLocksWeek>
>;

/** The picks a member has locked in this week, with how each went. */
export function LockedPicksList({ picks }: { picks: LockedPicks }) {
  if (picks.length === 0) {
    return <p className='text-muted-foreground'>No locked picks.</p>;
  }
  return (
    <ul className='grid gap-1'>
      {picks.map(pick => {
        const result =
          pick.isWin === 1
            ? { label: 'Won', tone: 'text-positive' }
            : pick.isLoss === 1
            ? { label: 'Lost', tone: 'text-negative' }
            : pick.isTie === 1
            ? { label: 'Tied', tone: 'text-muted-foreground' }
            : { label: 'Picked', tone: 'text-muted-foreground' };
        return (
          <li key={pick.id}>
            <span className={result.tone}>{result.label}</span>{' '}
            {pick.teamBet.mascot}
          </li>
        );
      })}
    </ul>
  );
}

export const LOCKS_HEADINGS = ['Points', 'W-L-T', 'Percent'];

/**
 * A locks challenge standings row: rank, member, points, record and win
 * share, opening to the picks they have locked in this week.
 */
export function locksStandingsEntry({
  rank,
  user,
  points,
  locksChallengeWonLoss,
  picksLocked,
}: {
  rank: number | undefined;
  user: User;
  points?: number;
  locksChallengeWonLoss: LocksGamePicksWonLoss;
  picksLocked?: LockedPicks;
}): LeaderboardEntry {
  const wins = locksChallengeWonLoss._sum?.isWin || 0;
  const losses = locksChallengeWonLoss._sum?.isLoss || 0;
  const ties = locksChallengeWonLoss._sum?.isTie || 0;
  const percent =
    wins > 0 || losses > 0 || ties > 0
      ? `${((wins / (wins + losses + ties)) * 100).toFixed(2)}%`
      : 'No picks';

  return {
    id: user.id,
    rank: rank ?? 0,
    name: (
      <ProfileLink userId={user.id}>
        <MemberName user={user} />
      </ProfileLink>
    ),
    values: [points ?? 0, `${wins}-${losses}-${ties}`, percent],
    details: picksLocked && <LockedPicksList picks={picksLocked} />,
  };
}
